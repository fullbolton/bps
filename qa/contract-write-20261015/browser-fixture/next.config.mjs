import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../../..');
const stub=path.join(import.meta.dirname,'stub.js');
export default {webpack(config){Object.assign(config.resolve.alias,{
 '@/qa/PendingPanel':path.join(root,'src/components/documents/PendingDocumentUploads.tsx'),
 '@/components/ui/useScopedResource':path.join(root,'src/components/ui/useScopedResource.ts'),
 '@/app/(main)/evraklar/upload-actions':stub,
 '@/lib/supabase/client':stub,
 '@/lib/services/document-pending-uploads':stub,
});return config;}};
