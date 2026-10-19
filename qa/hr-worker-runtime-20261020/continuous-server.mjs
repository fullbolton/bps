import https from 'node:https';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,bytes=readFileSync('/fixtures/clean.pdf'),sha=createHash('sha256').update(bytes).digest('hex');
const stats={claims:0,completionStarted:0,completed:0,validReport:false};
https.createServer({key:readFileSync('/tls/key.pem'),cert:readFileSync('/tls/cert.pem')},async(req,res)=>{
 if(req.headers.authorization!=='Bearer SYNTHETIC-ONLY'){res.writeHead(401).end();return;}
 res.setHeader('content-type','application/json');
 if(req.url==='/stats'){res.end(JSON.stringify(stats));return;}
 if(req.url===`/storage/v1/object/authenticated/hr-private/${id(1)}/${id(3)}.pdf`){res.setHeader('content-type','application/pdf');res.setHeader('content-length',bytes.length);res.end(bytes);return;}
 let body='';for await(const chunk of req)body+=chunk;const args=JSON.parse(body);
 if(req.url==='/rest/v1/rpc/hr_malware_claim_v1'){stats.claims++;res.end(JSON.stringify(stats.claims===1?{schemaVersion:1,tenantId:id(1),actorId:id(2),uploadId:id(3),leaseToken:id(4),attempt:1,leaseUntil:new Date(Date.now()+120000).toISOString()}:null));return;}
 if(args.p_tenant!==id(1)||args.p_upload!==id(3)||args.p_lease!==id(4)||args.p_worker!==id(5)){res.writeHead(403).end();return;}
 if(req.url==='/rest/v1/rpc/hr_malware_context_v1'){res.end(JSON.stringify({schemaVersion:1,actorId:id(2),tenantId:id(1),id:id(3),state:'pending',path:`${id(1)}/${id(3)}.pdf`,objectId:id(6),objectVersion:'synthetic',size:bytes.length,sha256:sha}));return;}
 if(req.url==='/rest/v1/rpc/hr_malware_complete_v1'){stats.completionStarted++;stats.validReport=args.p_report.verdict==='clean'&&args.p_report.complete===true&&args.p_report.sha256===sha;await new Promise(r=>setTimeout(r,5000));stats.completed++;res.end(JSON.stringify({schemaVersion:1,uploadId:id(3),state:'complete'}));return;}
 res.writeHead(404).end();
}).listen(8443,'0.0.0.0');
