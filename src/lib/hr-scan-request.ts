/** Small authenticated scan commands have both a byte limit and a read deadline. */
export async function readHrScanRequest(request:Request,timeoutMs=12000):Promise<unknown>{
 const reader=request.body?.getReader();if(!reader)throw Error('HR_INPUT');
 let timer:ReturnType<typeof setTimeout>|undefined;
 const read=async()=>{
  let text='',size=0;const decoder=new TextDecoder('utf-8',{fatal:true});
  for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>4096)throw Error('HR_INPUT');text+=decoder.decode(part.value,{stream:true});}
  return JSON.parse(text+decoder.decode());
 };
 try{return await Promise.race([read(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('HR_INPUT_TIMEOUT')),timeoutMs);})]);}
 finally{clearTimeout(timer);void reader.cancel().catch(()=>{});}
}
