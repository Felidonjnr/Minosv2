const fs = require('fs');
let html = fs.readFileSync('minos.html', 'utf8');

// Step 3: Replace the mixed Firebase/Supabase init function with proper Supabase code
const oldInit = `function initSupabase(){
  try{
    if(!firebase.apps.length)firebase.initializeApp(FBC);
    db=firebase.database();
    db.ref('deepseek-library').on('value',function(snap){
      items=snap.val()||{};
      updateBadges();
      renderLib();
    });
    setSyncStatus('live');
  }catch(e){
    setSyncStatus('off');
    toast('Supabase error -- check connection');
  }
}`;

const newInit = `function initSupabase(){
  try{
    supabase=supabase||createClient(SUPABASE_URL,SUPABASE_KEY);
    supabase.from('library_items').select('*').then(function(res){
      if(res.data&&res.data.length){
        items={};
        res.data.forEach(function(i){items[i.id]=i;});
        updateBadges();
        renderLib();
      }
      setSyncStatus('live');
    }).catch(function(){setSyncStatus('off');toast('Supabase error -- check connection');});
  }catch(e){
    setSyncStatus('off');
    toast('Supabase error -- check connection');
  }
}`;

if (html.includes(oldInit)) {
  html = html.replace(oldInit, newInit);
  fs.writeFileSync('minos.html', html);
  console.log('✅ Step 3: init function replaced with real Supabase code');
} else {
  console.log('❌ Step 3: Could not find the old function');
  // Debug: find the actual content
  const idx = html.indexOf('function initSupabase');
  if (idx > -1) {
    console.log('Found at position', idx);
    console.log('Content:', html.substring(idx, idx + 400));
  }
}

// Step 4: Remove old Firebase config
const fbConfigPos = html.indexOf('var FBC={');
if (fbConfigPos > -1) {
  // Find the end of the config block
  const configEnd = html.indexOf('};', fbConfigPos) + 2;
  const configBlock = html.substring(fbConfigPos, configEnd);
  if (configBlock.includes('messagingSenderId')) {
    // Full Firebase config - remove it
    const before = html.substring(0, fbConfigPos - 1);
    const after = html.substring(configEnd + 1);
    html = before + after;
    fs.writeFileSync('minos.html', html);
    console.log('✅ Step 4: Removed old Firebase config (FBC object)');
  }
}

// Verify syntax
const fs2 = require('fs');
const updatedHtml = fs2.readFileSync('minos.html', 'utf8');
const scriptStart = updatedHtml.indexOf('<script>');
const scriptEnd = updatedHtml.indexOf('</script>', scriptStart + 8);
const js = updatedHtml.substring(scriptStart + 8, scriptEnd);
try {
  new Function(js);
  console.log('✅ Final syntax: CLEAN');
} catch(e) {
  console.log('❌ Final syntax:', e.message);
}
