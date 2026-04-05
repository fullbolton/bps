/**
 * Batch 6 — Contract-context commercial preparation types.
 * Preparation history is optional metadata on the contract, not a separate entity.
 */

export interface TicariHazirlikAdimi {
  /** Milestone name: e.g. "Teklif Hazırlandı", "Teklif Gönderildi", "Sözleşme İmzalandı" */
  adim: string;
  tarih: string;
  user: string;
  not?: string;
  /** Whether this milestone has been completed */
  tamamlandi: boolean;
}

export interface TicariHazirlik {
  /** Ordered preparation milestones for this contract */
  adimlar: TicariHazirlikAdimi[];
  /** Reference note for signed PDF if it exists in dosyalar — display only, not an upload action */
  imzaliPdfNotu?: string;
}
