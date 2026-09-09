export type Invitation={id:string;email:string;role:string;expiresAt:string;state:'pending'|'accepted'|'cancelled'|'expired'};
export function parseInvitation(v:unknown):Invitation{
 if(!v||typeof v!=='object')throw Error('Davet yanıtı okunamadı.');const r=v as Record<string,unknown>;
 if(typeof r.id!=='string'||!/^[0-9a-f-]{36}$/.test(r.id)||typeof r.email!=='string'||typeof r.role!=='string'||!['operasyon','ik','muhasebe','goruntuleyici'].includes(r.role)||typeof r.expiresAt!=='string'||!Number.isFinite(Date.parse(r.expiresAt))||typeof r.state!=='string'||!['pending','accepted','cancelled','expired'].includes(r.state))throw Error('Davet yanıtı okunamadı.');
 return {id:r.id,email:r.email,role:r.role,expiresAt:r.expiresAt,state:r.state as Invitation['state']};
}
export function parseInvitations(v:unknown){if(!Array.isArray(v)||v.length>50)throw Error('Davetler okunamadı.');const rows=v.map(parseInvitation);if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Davetler okunamadı.');return rows;}
export function newInvitationToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');}
export function invitationError(error:unknown){
 const m=error&&typeof error==='object'&&'message' in error?String(error.message):'';
 if(m.includes('INVITE_EXISTING_MEMBER'))return 'Bu hesap zaten bir çalışma alanına bağlı. Yöneticiyle görüşün; mevcut üyelik değiştirilmedi.';
 if(m.includes('INVITE_STALE_SESSION'))return 'Oturumda eski çalışma alanı bilgisi var. Çıkış yapıp yeniden giriş yaptıktan sonra kodu tekrar kullanın.';
 if(m.includes('INVITE_IDENTITY'))return 'Davet edilen, e-postası doğrulanmış hesapla giriş yapın.';
 if(m.includes('INVITE_INVALID'))return 'Davet geçersiz, iptal edilmiş veya süresi dolmuş.';
 if(m.includes('INVITE_ACCOUNT_REVIEW'))return 'Bu hesap için platform yöneticisinin incelemesi gerekiyor.';
 if(m.includes('INVITE_REVOKED'))return 'Davet eden kişinin yetkisi değişmiş. Yeni bir davet isteyin.';
 if(m.includes('INVITE_ACCEPTED'))return 'Kabul edilmiş davet iptal edilemez.';
 return 'İşlem doğrulanamadı. Aynı işlemle yeniden deneyin.';
}
