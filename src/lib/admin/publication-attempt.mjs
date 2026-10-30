/** One editor publication attempt remains pinned until its PR is confirmed finished. */
export function createPublicationAttempt(){
 let pending=null;
 return {run(operation){pending??=Promise.resolve().then(operation);return pending;},finish(){pending=null;}};
}
