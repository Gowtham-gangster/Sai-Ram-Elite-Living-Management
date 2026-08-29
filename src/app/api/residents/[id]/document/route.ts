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
      return NextResponse.json({ error: 'Resident ID is required' }, { status: 400 });
    }

    // 2. Fetch Resident Record
    const resident = await db.resident.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        identityDocumentUrl: true,
        googleDriveFileId: true,
      },
    });

    if (!resident) {
      return NextResponse.json({ error: 'Resident not found' }, { status: 404 });
    }

    // 3. Extract Google Drive File ID (with fallback to associated Registration if needed)
    let rawRef = resident.googleDriveFileId || resident.identityDocumentUrl;
    
    if (!rawRef) {
      const linkedReg = await db.registration.findFirst({
        where: { residentId: id },
        select: { googleDriveFileId: true, identityDocumentUrl: true },
      });
      if (linkedReg) {
        rawRef = linkedReg.googleDriveFileId || linkedReg.identityDocumentUrl;
      }
    }

    if (!rawRef) {
      return NextResponse.json(
        { error: 'No identity document attachment linked to this resident profile.' },
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
      console.error(`[Google Drive Error] Resident File ${fileId} get metadata failed:`, driveErr.message);
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
        file: {
          fileId: fileMeta.data.id,
          name: fileMeta.data.name,
          mimeType: fileMeta.data.mimeType,
          size: fileMeta.data.size,
        },
      });
    }

    // 5. Stream the File Content securely to client
    const response = await drive.files.get(
      {
        fileId,
        alt: 'media',
        supportsAllDrives: true,
      },
      { responseType: 'stream' }
    );

    const stream = response.data as Readable;
    const mimeType = fileMeta.data.mimeType || 'application/octet-stream';
    const fileName = fileMeta.data.name || `${resident.fullName.replace(/\s+/g, '_')}_ID_Proof`;

    const headers = new Headers();
    headers.set('Content-Type', mimeType);

    if (action === 'download') {
      headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    } else {
      headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    }

    // Convert Node Readable stream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        stream.on('end', () => {
          controller.close();
        });
        stream.on('error', (err) => {
          controller.error(err);
        });
      },
      cancel() {
        stream.destroy();
      },
    });

    return new NextResponse(webStream, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('Error fetching resident identity document:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error while fetching document' },
      { status: 500 }
    );
  }
}
