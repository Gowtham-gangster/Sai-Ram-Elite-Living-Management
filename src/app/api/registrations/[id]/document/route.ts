import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getGoogleAuthClient } from '@/lib/google/auth';
import { extractGoogleDriveDoc } from '@/lib/google/driveExtractor';
import { Readable } from 'stream';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate Administrator Session
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Authenticated admin session required.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Registration ID is required' }, { status: 400 });
    }

    // 2. Fetch Registration Record
    const registration = await db.registration.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        identityDocumentUrl: true,
        googleDriveFileId: true,
      },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    // 3. Extract Google Drive File ID
    const rawRef = registration.googleDriveFileId || registration.identityDocumentUrl;
    if (!rawRef) {
      return NextResponse.json(
        { error: 'No identity document attachment linked to this registration.' },
        { status: 404 }
      );
    }

    const docInfo = extractGoogleDriveDoc(rawRef);
    const fileId = docInfo.fileId;

    if (!fileId) {
      return NextResponse.json(
        { error: 'Invalid Google Drive document reference.' },
        { status: 404 }
      );
    }

    // 4. Authenticate Server-Side with Google Drive API
    const auth = getGoogleAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    // Fetch File Metadata
    let fileMeta;
    try {
      fileMeta = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, originalFilename',
        supportsAllDrives: true,
      });
    } catch (driveErr: any) {
      console.error(`[Google Drive Error] File ${fileId} get metadata failed:`, driveErr.message);
      if (driveErr.code === 404 || driveErr.status === 404) {
        return NextResponse.json(
          { error: 'Document file not found in Google Drive or has been deleted.' },
          { status: 404 }
        );
      }
      if (driveErr.code === 403 || driveErr.status === 403) {
        return NextResponse.json(
          { error: 'Permission denied accessing Google Drive document with service account.' },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: 'Unable to connect to Google Drive service.' },
        { status: 502 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'view';

    // If metadata info requested
    if (action === 'info') {
      return NextResponse.json({
        success: true,
        fileId: fileMeta.data.id,
        name: fileMeta.data.name || `${registration.fullName}_ID_Proof`,
        mimeType: fileMeta.data.mimeType || 'application/octet-stream',
        size: fileMeta.data.size ? parseInt(fileMeta.data.size, 10) : null,
        hasAccess: true,
      });
    }

    // 5. Fetch and Stream Document Media
    const driveMediaRes = await drive.files.get(
      {
        fileId,
        alt: 'media',
        supportsAllDrives: true,
      },
      { responseType: 'stream' }
    );

    const nodeStream = driveMediaRes.data as unknown as Readable;
    const fileName = fileMeta.data.name || `${registration.fullName.replace(/[^a-zA-Z0-9_-]/g, '_')}_ID_Proof`;
    const mimeType = fileMeta.data.mimeType || 'application/octet-stream';
    const isDownload = action === 'download';

    // Convert Node Readable stream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        nodeStream.on('end', () => {
          controller.close();
        });
        nodeStream.on('error', (err) => {
          console.error('[Stream Error]', err);
          controller.error(err);
        });
      },
    });

    const headers = new Headers();
    headers.set('Content-Type', mimeType);
    headers.set(
      'Content-Disposition',
      `${isDownload ? 'attachment' : 'inline'}; filename="${fileName}"`
    );
    headers.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');
    headers.set('X-Content-Type-Options', 'nosniff');

    if (fileMeta.data.size) {
      headers.set('Content-Length', fileMeta.data.size);
    }

    return new NextResponse(webStream, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('Error serving registration document:', error);
    return NextResponse.json(
      { error: 'Internal server error processing document request.' },
      { status: 500 }
    );
  }
}
