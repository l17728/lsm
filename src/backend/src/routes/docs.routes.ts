import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// Documentation files mapping
const docsMapping: Record<string, { path: string; title: string }> = {
  'user-manual': { path: 'USER_MANUAL.md', title: '用户手册' },
  'operations-manual': { path: 'OPERATIONS_MANUAL.md', title: '运维手册' },
  'api-docs': { path: 'API_v3.md', title: 'API 文档' },
  'release-notes': { path: 'RELEASE_NOTES.md', title: '发布说明' },
};

// Get list of available documents
router.get('/', (req: Request, res: Response) => {
  const documents = Object.entries(docsMapping).map(([id, doc]) => ({
    id,
    title: doc.title,
    filename: doc.path,
  }));

  res.json({ documents });
});

// Get document content by ID
router.get('/:docId', (req: Request, res: Response) => {
  const { docId } = req.params;
  const docInfo = docsMapping[docId];

  if (!docInfo) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Resolve the document path
  const docsRoot = path.join(__dirname, '../../docs');
  const docPath = path.join(docsRoot, docInfo.path);

  // Security check: ensure path is within docs directory
  const resolvedPath = path.resolve(docPath);
  if (!resolvedPath.startsWith(path.resolve(docsRoot))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    res.json({
      id: docId,
      title: docInfo.title,
      content,
    });
  } catch (error) {
    console.error(`Error reading document ${docId}:`, error);
    res.status(500).json({ error: 'Failed to read document' });
  }
});

export default router;