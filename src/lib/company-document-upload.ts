/** Shared client-safe outcome for both company and general document forms. */
export class DocumentUploadReviewRequiredError extends Error {
  constructor(message: string) { super(message); this.name = "DocumentUploadReviewRequiredError"; }
}
