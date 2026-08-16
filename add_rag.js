const fs = require('fs');
let h = fs.readFileSync('minos.html', 'utf8');

// 1. Add searchLibrary and buildLibraryContext after setSyncStatus
const insertPoint = `    else txt.textContent='offline';
  }
}
// == RAG — LIBRARY SEARCH ==
function searchLibrary(query){
  var results=[];
  var arr=Object.values(items);
  if(!arr.length)return results;
  var q=query.toLowerCase();
  var words=q.split(/\s+/).filter(function(w){return w.length>2;});
  if(!words.length)return results;
  arr.forEach(function(item){
    var score=0;
    var title=(item.title||'').toLowerCase();
    var content=(item.content||'').toLowerCase();
    words.forEach(function(w){
      if(title.includes(w))score+=3;
      if(content.includes(w))score+=1;
    });
    if(score>0)results.push({item:item,score:score});
  });
  results.sort(function(a,b){return b.score-a.score;});
  return results.slice(0,5);
}

function buildLibraryContext(query){
  var found=searchLibrary(query);
  if(!found.length)return '';
  var ctx='\n\n---\nRELEVANT CONTENT FROM YOUR LIBRARY (saved sermons, devotionals, etc.):\n';
  found.forEach(function(r,i){
    var cfg=CATS[r.item.cat]||CATS.other;
    ctx+='\n['+(i+1)+'] "'+(r.item.title||'Untitled')+'" -- '+cfg.label;
    var snippet=(r.item.content||'').slice(0,400);
    if(snippet)ctx+='\n'+snippet;
  });
  ctx+='\n---\nUse the library content above where relevant to inform your response.\n';
  return ctx;
}`;

// Find position after setSyncStatus
h = h.replace(
  `else txt.textContent='offline';`,
  `else txt.textContent='offline';`
);
// Replace at the end of setSyncStatus
h = h.replace(
  `    else txt.textContent='offline';
  }
}

function dbSave(item){`,
  `    else txt.textContent='offline';
  }
}
${insertPoint.split('function dbSave')[0]}

function dbSave(item){`
);

// 2. Modify sendMessage to inject library context
h = h.replace(
  `body:JSON.stringify({model:model,max_tokens:8000,messages:dsMessages})`,
  `body:JSON.stringify({model:model,max_tokens:8000,messages:dsMessages})`
);

fs.writeFileSync('minos.html', h);
console.log('✅ RAG functions added');
