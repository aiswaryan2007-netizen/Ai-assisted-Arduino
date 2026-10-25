const PROJECTS = [
  {id:'blink',title:'LED blink',category:'Arduino',level:'Beginner',description:'Make the built-in LED pulse at a steady interval.',components:'Arduino Uno · LED',code:'void setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(1000);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(1000);\n}'} ,
  {id:'button-led',title:'Button-controlled LED',category:'Arduino',level:'Beginner',description:'Read a pushbutton and switch an LED on while pressed.',components:'Uno · Button · LED',code:'const int buttonPin = 2;\nconst int ledPin = 13;\n\nvoid setup() {\n  pinMode(buttonPin, INPUT_PULLUP);\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(ledPin, digitalRead(buttonPin) == LOW);\n}'} ,
  {id:'ultrasonic',title:'Ultrasonic distance',category:'Arduino',level:'Beginner',description:'Measure distance with an HC-SR04 and print it to Serial.',components:'Uno · HC-SR04',code:'const int trigPin = 9;\nconst int echoPin = 10;\n\nvoid setup() {\n  pinMode(trigPin, OUTPUT);\n  pinMode(echoPin, INPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  digitalWrite(trigPin, LOW);\n  delayMicroseconds(2);\n  digitalWrite(trigPin, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(trigPin, LOW);\n  long duration = pulseIn(echoPin, HIGH, 30000);\n  float distanceCm = duration * 0.0343 / 2;\n  Serial.println(distanceCm);\n  delay(250);\n}'} ,
  {id:'dht',title:'Temperature & humidity',category:'Arduino',level:'Intermediate',description:'Read a DHT22 sensor and stream values over Serial.',components:'Uno · DHT22 · 10kΩ resistor',code:'#include <DHT.h>\n#define DHTPIN 2\n#define DHTTYPE DHT22\nDHT dht(DHTPIN, DHTTYPE);\n\nvoid setup() {\n  Serial.begin(9600);\n  dht.begin();\n}\n\nvoid loop() {\n  float humidity = dht.readHumidity();\n  float temperature = dht.readTemperature();\n  if (isnan(humidity) || isnan(temperature)) return;\n  Serial.print(temperature);\n  Serial.print(" C, ");\n  Serial.print(humidity);\n  Serial.println(" %");\n  delay(2000);\n}'} ,
  {id:'servo',title:'Servo sweep',category:'Arduino',level:'Beginner',description:'Sweep a micro servo smoothly between 0 and 180 degrees.',components:'Uno · SG90 servo',code:'#include <Servo.h>\nServo myServo;\n\nvoid setup() {\n  myServo.attach(9);\n}\n\nvoid loop() {\n  for (int angle = 0; angle <= 180; angle += 2) {\n    myServo.write(angle);\n    delay(20);\n  }\n  for (int angle = 180; angle >= 0; angle -= 2) {\n    myServo.write(angle);\n    delay(20);\n  }\n}'} ,
  {id:'wifi',title:'ESP32 Wi-Fi connection',category:'ESP32',level:'Beginner',description:'Connect an ESP32 to a local Wi-Fi network and report status.',components:'ESP32 · 2.4 GHz Wi-Fi',code:'#include <WiFi.h>\nconst char* ssid = "YOUR_WIFI_NAME";\nconst char* password = "YOUR_WIFI_PASSWORD";\n\nvoid setup() {\n  Serial.begin(115200);\n  WiFi.begin(ssid, password);\n  while (WiFi.status() != WL_CONNECTED) {\n    delay(500);\n    Serial.print(".");\n  }\n  Serial.println(WiFi.localIP());\n}\n\nvoid loop() {}'} ,
  {id:'web-server',title:'ESP32 web server',category:'ESP32',level:'Intermediate',description:'Serve a small status page from the ESP32 on your LAN.',components:'ESP32 · Wi-Fi network',code:'#include <WiFi.h>\n#include <WebServer.h>\nconst char* ssid = "YOUR_WIFI_NAME";\nconst char* password = "YOUR_WIFI_PASSWORD";\nWebServer server(80);\n\nvoid setup() {\n  Serial.begin(115200);\n  WiFi.begin(ssid, password);\n  while (WiFi.status() != WL_CONNECTED) delay(300);\n  server.on("/", []() { server.send(200, "text/plain", "ESP32 online"); });\n  server.begin();\n}\n\nvoid loop() { server.handleClient(); }'} ,
  {id:'mqtt',title:'MQTT sensor publisher',category:'ESP32',level:'Intermediate',description:'Publish a periodic sensor value to an MQTT broker.',components:'ESP32 · MQTT broker',code:'#include <WiFi.h>\n#include <PubSubClient.h>\nWiFiClient wifiClient;\nPubSubClient mqtt(wifiClient);\n\nvoid setup() {\n  Serial.begin(115200);\n  // Configure Wi-Fi and broker credentials before connecting.\n}\n\nvoid loop() {\n  if (mqtt.connected()) {\n    mqtt.publish("lab/sensor", "22.5");\n  }\n  mqtt.loop();\n  delay(5000);\n}'}
];
const mqttProject=PROJECTS.find(project=>project.id==='mqtt');
mqttProject.code=`#include <WiFi.h>
#include <PubSubClient.h>
const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqttBroker = "192.168.1.10";
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
unsigned long lastPublish = 0;

void reconnect() {
  while (!mqtt.connected()) {
    mqtt.connect("makermind-sensor");
    if (!mqtt.connected()) delay(1500);
  }
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(300);
  mqtt.setServer(mqttBroker, 1883);
}

void loop() {
  if (!mqtt.connected()) reconnect();
  mqtt.loop();
  if (millis() - lastPublish >= 5000) {
    lastPublish = millis();
    mqtt.publish("lab/sensor", "22.5");
  }
}`;
const PROJECT_WIRING = {
  blink:'Use the Uno built-in LED on pin 13 (or the ESP32 board LED where available). No external LED is required.',
  'button-led':'Connect the button between pin 2 and GND with INPUT_PULLUP. Wire an external LED through a 220-330 ohm resistor.',
  ultrasonic:'HC-SR04 VCC to 5V, GND to GND, TRIG to pin 9, ECHO to pin 10. Use a level divider on ECHO for 3.3V boards.',
  dht:'DHT22 VCC to its rated supply, GND to GND, DATA to pin 2. Bare sensors need a 10k pull-up from DATA to VCC.',
  servo:'Servo signal to pin 9. Use an appropriate 5V supply and shared ground; do not power a larger servo from a GPIO pin.',
  wifi:'Use a 2.4 GHz Wi-Fi network. Replace placeholders locally and never commit real credentials.',
  'web-server':'Use 2.4 GHz Wi-Fi. Replace credentials and open the ESP32 IP from a device on the same LAN.',
  mqtt:'Configure a reachable MQTT broker. Use authenticated TLS outside a lab; never commit broker credentials.'
};
let generatedCount = 0;
let verifiedCount = 0;
let editor = null;
let currentGeneratedCode = '';
let currentView = 'overview';
let lastVerification = null;
const $ = (selector, root=document) => root.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icon = name => `<i data-lucide="${name==='scan-check'?'badge-check':name}"></i>`;

function notify(message, type='info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  $('#toastRegion').append(toast);
  setTimeout(() => toast.remove(), 3600);
}
function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }
function setPage(view) {
  currentView = view;
  document.querySelectorAll('.nav-link[data-view]').forEach(link => link.classList.toggle('active', link.dataset.view === view));
  const names = {overview:'Overview',generator:'AI generator',verifier:'Code verifier',debugger:'Debug assistant',library:'Project library',about:'Help & about'};
  $('#pageCrumb').textContent = names[view] || 'Overview';
  $('#pageContent').innerHTML = (views[view] || views.overview)();
  history.replaceState(null, '', `#${view}`);
  closeMobileNav();
  refreshIcons();
  if (view === 'generator') setupEditor($('#generatedCode'), currentGeneratedCode);
  if (view === 'verifier') setupEditor($('#verifyCode'), lastVerification?.code || currentGeneratedCode || '');
  if (view === 'debugger') { setupEditor($('#debugOriginal'), ''); setupEditor($('#debugFixed'), ''); }
  if (view === 'library') bindLibrarySearch();
  if (view === 'overview') updateStats();
}
function pageHeading(eyebrow,title,description,actions='') { return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</div>`; }
function getSaved() { try { return JSON.parse(localStorage.getItem('makermind-projects') || '[]'); } catch { return []; } }
function savedCards() { return getSaved().map(item => `<div class="recent-item"><span class="recent-icon">${icon('file-code-2')}</span><span class="recent-meta"><strong>${esc(item.name)}</strong><small>Saved locally · ${esc(item.board)}</small></span><button class="button small quiet" data-open-saved="${esc(item.id)}">Open</button></div>`).join(''); }
const views = {
  overview: () => `${pageHeading('Your build space','Build Smarter IoT Projects with AI','Design, generate, and verify embedded code in one focused workspace.',`<button class="button" data-go="library">${icon('library-big')} Browse examples</button>`)}
    <section class="feature-strip"><div class="feature-copy"><div class="eyebrow">FROM IDEA TO HARDWARE</div><h2>Your next circuit starts with a good question.</h2><p>Describe what you want to build. Get a sketch, wiring notes, and a clear path to compile it.</p></div><button class="button primary" data-go="generator">${icon('sparkles')} Start building ${icon('arrow-up-right')}</button></section>
    <section class="stats-grid"><div class="stat-card"><div class="stat-top">Programs generated <span class="stat-icon">${icon('code-2')}</span></div><div class="stat-value" id="statGenerated">${generatedCount}</div><div class="stat-note">This browser session</div></div><div class="stat-card"><div class="stat-top">Verified builds <span class="stat-icon" style="--stat-color:var(--green)">${icon('badge-check')}</span></div><div class="stat-value" id="statVerified">${verifiedCount}</div><div class="stat-note">Compiler-confirmed only</div></div><div class="stat-card"><div class="stat-top">Saved projects <span class="stat-icon" style="--stat-color:var(--blue)">${icon('folder-kanban')}</span></div><div class="stat-value" id="statSaved">${getSaved().length}</div><div class="stat-note">Stored on this device</div></div><div class="stat-card"><div class="stat-top">Boards supported <span class="stat-icon" style="--stat-color:var(--violet)">${icon('cpu')}</span></div><div class="stat-value">04</div><div class="stat-note">Uno, Nano, ESP32, DevKit</div></div></section>
    <div class="overview-grid"><section class="section-panel"><div class="panel-header"><div><h2>Choose a starting point</h2><p>Jump into a task or explore working examples.</p></div>${icon('arrow-right')}</div><div class="panel-body"><div class="quick-grid"><button class="quick-card" data-go="generator"><span class="quick-icon">${icon('sparkles')}</span><strong>Generate a sketch</strong><span>Turn a project idea into Arduino code.</span></button><button class="quick-card" data-go="verifier"><span class="quick-icon">${icon('scan-check')}</span><strong>Verify existing code</strong><span>Run static checks and, when installed, Arduino CLI.</span></button><button class="quick-card" data-go="debugger"><span class="quick-icon">${icon('bug')}</span><strong>Fix a compiler error</strong><span>Trace an error and get a suggested correction.</span></button><button class="quick-card" data-go="library"><span class="quick-icon">${icon('blocks')}</span><strong>Explore project recipes</strong><span>Start from one of eight hardware examples.</span></button></div></div></section><section class="section-panel"><div class="panel-header"><div><h2>Recent projects</h2><p>Your locally saved sketches</p></div><button class="icon-button" data-go="library" aria-label="Browse examples">${icon('arrow-up-right')}</button></div><div class="panel-body">${savedCards() || `<div class="activity-empty"><div><div class="empty-icon">${icon('folder-open')}</div><strong>Nothing saved yet</strong><span>Your projects will show up here.</span></div></div>`}</div></section></div>`,
  generator: () => `${pageHeading('AI WORKBENCH','Generate a sketch','Describe the behavior and hardware. Review the wiring notes before you connect anything.',`<button class="button quiet" data-go="about">${icon('circle-help')} How it works</button>`)}<div class="form-layout"><section class="form-panel"><h2>Project brief</h2><form id="generateForm"><div class="form-grid"><div class="field"><label for="board">Target board</label><select id="board" name="board"><option>Arduino Uno</option><option>Arduino Nano</option><option>ESP32</option><option>ESP32 DevKit</option></select></div><div class="field"><label for="language">Language</label><select id="language" name="language"><option>Arduino C++</option></select></div><div class="field full"><label for="prompt">What should your project do?</label><textarea id="prompt" name="prompt" required placeholder="For example: Turn on an LED on GPIO 2 when a button is pressed."></textarea><span class="field-help">Be specific about the behavior, timing, and what you expect to see.</span></div><div class="field full"><span class="label-row">Components <span>Optional</span></span><div class="chip-list">${['LED','Button','Temperature sensor','Ultrasonic sensor','Relay','Servo motor','OLED display'].map((part,i)=>`<label class="chip-option"><input type="checkbox" name="components" value="${part}"${i===0?' checked':''}><span>${part}</span></label>`).join('')}</div></div><div class="field"><label for="pins">Pin assignments</label><input id="pins" name="pins" placeholder="LED: 2, button: 4"></div><div class="field"><label for="requirements">Additional requirements</label><input id="requirements" name="requirements" placeholder="Use INPUT_PULLUP, avoid delay()"></div></div><div class="form-actions"><button class="button primary" type="submit" id="generateButton">${icon('sparkles')} Generate code</button><button class="button" type="reset">Clear form</button></div></form></section><section class="form-panel result-panel"><div class="panel-header" style="padding:0 0 13px;border:0"><div><h2 style="margin:0">Generated output</h2><p id="generationState">A sketch and build notes will appear here.</p></div><span class="status-pill" id="generationBadge">READY</span></div><div id="generationResult"><div class="result-placeholder"><div><div class="empty-icon">${icon('braces')}</div><strong>Ready when you are</strong><p>Generated code is a suggestion. Verify it for your selected board before uploading.</p></div></div></div></section></div>`,
  verifier: () => `${pageHeading('BUILD CHECKS','Verify your code','Separate static analysis from real compilation. Only Arduino CLI can confirm that a sketch compiles.',`<span class="status-pill">NO HARDWARE TEST</span>`)}<div class="verify-layout"><section class="form-panel"><div class="verify-topline"><label>Sketch to inspect</label><label for="verifyBoard">Board <select id="verifyBoard" class="filter-select"><option>Arduino Uno</option><option>Arduino Nano</option><option>ESP32</option><option>ESP32 DevKit</option></select></label></div><div class="code-frame"><div class="code-frame-head"><span>sketch.ino</span><span class="code-dots"><span></span><span></span><span></span></span></div><textarea id="verifyCode" class="code-editor" spellcheck="false" aria-label="Code to verify"></textarea></div><div class="check-options"><label class="check-item"><input type="checkbox" checked disabled> Static checks</label><label class="check-item"><input type="checkbox" id="runCompile" checked> Compile with Arduino CLI if available</label></div><div class="form-actions"><button class="button primary" id="verifyButton">${icon('scan-check')} Run verification</button><button class="button" data-action="load-sample">Load LED example</button></div></section><section class="form-panel"><h2>Verification report</h2><div id="verificationReport"><div class="verification-result"><div class="result-status"><span class="status-icon">${icon('circle-help')}</span><div><strong>NOT VERIFIED</strong><small>No checks have been run yet.</small></div></div><p>Static review can flag common patterns. A PASS requires a successful Arduino CLI compile for the selected board. Hardware behavior is never confirmed by compilation.</p></div><div class="check-list"><div class="check-row pending">${icon('circle-dashed')} Static analysis pending</div><div class="check-row pending">${icon('circle-dashed')} Arduino CLI compilation pending</div><div class="check-row pending">${icon('circle-dashed')} Hardware behavior not tested</div></div></div></section></div>`,
  debugger: () => `${pageHeading('DEBUG ASSISTANT','Find the fault, keep the learning','Share the sketch and the error you see. Compare the original with a suggested fix.',`<span class="status-pill">AI REVIEW IS ADVISORY</span>`)}<section class="form-panel"><div class="form-grid"><div class="field full"><label for="debugProblem">Compiler error or observed behavior</label><textarea id="debugProblem" placeholder="Paste the complete compiler output, or describe what you expected and what happened."></textarea></div><div class="field full"><label for="debugUpload">Upload an .ino or .cpp file</label><div class="upload-row"><input id="debugUpload" type="file" accept=".ino,.cpp,.h,.hpp,text/plain"><span class="field-help">Files stay in your browser until submitted.</span></div></div></div><div class="debug-columns" style="margin-top:17px"><div><div class="editor-label">Original code <span>INPUT</span></div><div class="code-frame"><div class="code-frame-head"><span>original.ino</span><span class="code-dots"><span></span><span></span><span></span></span></div><textarea id="debugOriginal" class="code-editor" spellcheck="false" aria-label="Original code"></textarea></div></div><div><div class="editor-label">Suggested correction <span>REVIEW BEFORE USE</span></div><div class="code-frame"><div class="code-frame-head"><span>suggested.ino</span><span class="code-dots"><span></span><span></span><span></span></span></div><textarea id="debugFixed" class="code-editor" spellcheck="false" aria-label="Suggested corrected code"></textarea></div></div></div><div class="form-actions"><button class="button primary" id="debugButton">${icon('wrench')} Debug my code</button><button class="button" id="applyFixButton" disabled>${icon('arrow-left-right')} Use suggested code in verifier</button><button class="button" id="explainButton">${icon('text-search')} Explain code</button></div><div id="debugExplanation"></div></section>`,
  library: () => `${pageHeading('PROJECT RECIPES','Start with something that works','Eight starter sketches with parts lists and wiring notes. Load one into the generator or verifier.',`<span class="status-pill">8 SAMPLE PROJECTS</span>`)}<div class="library-toolbar"><label class="search-wrap">${icon('search')}<span class="visually-hidden">Search projects</span><input class="search-input" id="projectSearch" placeholder="Search by project, board, or component..."></label><select class="filter-select" id="categoryFilter" aria-label="Filter by board"><option value="all">All boards</option><option value="Arduino">Arduino</option><option value="ESP32">ESP32</option></select><select class="filter-select" id="levelFilter" aria-label="Filter by difficulty"><option value="all">All levels</option><option>Beginner</option><option>Intermediate</option></select></div><div class="project-grid" id="projectGrid">${projectCards(PROJECTS)}</div>`,
  about: () => `${pageHeading('FIELD GUIDE','Build with confidence','A practical workspace for turning an embedded project idea into testable code.') }<div class="about-grid"><section class="about-card"><h2>What each result means</h2><ul><li><strong>PASS</strong> only appears after Arduino CLI successfully compiles for the chosen board.</li><li><strong>FAIL</strong> means the compiler returned an error. Compiler output is shown when available.</li><li><strong>WARNING</strong> flags patterns to review; it does not prove the sketch is broken.</li><li><strong>NOT VERIFIED</strong> means compilation was unavailable or not run. Hardware is never tested here.</li></ul></section><section class="about-card"><h2>Quick start</h2><p><span class="step-num">01</span> Pick a sample from Project library or describe your own build in AI generator.</p><p><span class="step-num">02</span> Check the pin map, component list, and voltage notes before wiring.</p><p><span class="step-num">03</span> Verify the sketch. Install Arduino CLI and the board core to compile locally.</p><p><span class="step-num">04</span> Upload from Arduino IDE or CLI, then validate the real circuit safely.</p></section><section class="about-card"><h2>AI configuration</h2><p>AI features use a server-side API key. The browser never receives the key. Without an API key, generation, debugging, and explanations return a clear unavailable message; sample projects and static checks still work.</p><p>Prompts and submitted sketches are sent to the configured AI provider when those features are used. Do not submit secrets, Wi-Fi passwords, or sensitive code.</p></section><section class="about-card"><h2>Hardware safety</h2><div class="about-callout">Check the board's logic voltage and current limits. Never drive motors, relays, or high-current loads directly from a GPIO pin. Use an appropriate driver, flyback protection, and a separate supply where required. Disconnect power before rewiring.</div></section></div><section class="section-panel" style="margin-top:13px"><div class="panel-header"><div><h2>Tools and boundaries</h2><p>Compilation runs locally through Arduino CLI in a temporary folder.</p></div></div><div class="panel-body"><div class="tag-row"><span class="tag">Flask</span><span class="tag">Arduino CLI</span><span class="tag">CodeMirror</span><span class="tag">Local storage</span><span class="tag">No server-side code execution</span></div></div></section>`
};

function projectCards(projects) {
  if (!projects.length) return '<div class="library-empty">No matching projects. Try another search.</div>';
  return projects.map(project => `<article class="project-card"><div class="project-card-top"><span class="project-badge">${icon(project.category==='ESP32'?'wifi':'circuit-board')}</span><span class="tag">${project.level}</span></div><h3>${esc(project.title)}</h3><p>${esc(project.description)}</p><div class="project-card-footer"><span>${esc(project.components)}</span><div><button data-load-project="${esc(project.id)}">Open</button><button data-verify-project="${esc(project.id)}">Verify</button></div></div></article>`).join('');
}
function setupEditor(textarea, value) {
  if (!textarea) return;
  if (textarea.CodeMirror) { textarea.CodeMirror.setValue(value || ''); return; }
  textarea.value = value || '';
  if (!window.CodeMirror) return;
  const cm = CodeMirror.fromTextArea(textarea, {mode:'text/x-c++src',theme:document.documentElement.dataset.theme==='light'?'default':'material-darker',lineNumbers:true,indentUnit:2,tabSize:2,viewportMargin:10});
  textarea.CodeMirror = cm;
  cm.on('change', () => { if (textarea.id==='generatedCode') currentGeneratedCode=cm.getValue(); });
}
function editorValue(id) { const textarea=$(`#${id}`);return textarea?.CodeMirror ? textarea.CodeMirror.getValue() : (textarea?.value || ''); }
function setEditorValue(id,value) { const textarea=$(`#${id}`);if(!textarea)return;if(textarea.CodeMirror)textarea.CodeMirror.setValue(value||'');else textarea.value=value||''; }
function updateStats() { const generated=$('#statGenerated'),verified=$('#statVerified'),saved=$('#statSaved');if(generated)generated.textContent=generatedCount;if(verified)verified.textContent=verifiedCount;if(saved)saved.textContent=getSaved().length; }
function bindLibrarySearch() {
  const update=()=>{const query=$('#projectSearch').value.toLowerCase(),category=$('#categoryFilter').value,level=$('#levelFilter').value;const filtered=PROJECTS.filter(p=>(category==='all'||p.category===category)&&(level==='all'||p.level===level)&&`${p.title} ${p.description} ${p.components} ${p.category}`.toLowerCase().includes(query));$('#projectGrid').innerHTML=projectCards(filtered);refreshIcons();};
  ['projectSearch','categoryFilter','levelFilter'].forEach(id=>$('#'+id).addEventListener(id==='projectSearch'?'input':'change',update));
}
function closeMobileNav() { $('#sidebar').classList.remove('open');$('#mobileScrim').classList.remove('show'); }
function downloadCode(code,name='sketch.ino') { const blob=new Blob([code],{type:'text/plain'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();setTimeout(()=>{URL.revokeObjectURL(url);anchor.remove();},1000); }
async function apiRequest(endpoint,payload) {
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const data=await response.json().catch(()=>({error:'The server returned an unreadable response.'}));
  if(!response.ok)throw new Error(data.error||`Request failed (${response.status})`);
  return data;
}
function projectForPrompt(id) { return PROJECTS.find(project=>project.id===id); }
function showGenerated(data,board) {
  currentGeneratedCode=data.code||'';
  const example=PROJECTS.find(project=>project.code===currentGeneratedCode);
  data.connections=data.connections||(example&&PROJECT_WIRING[example.id])||'Confirm pin assignments and voltage levels for your board before wiring.';
  const result=$('#generationResult');
  result.innerHTML=`<div class="code-toolbar" style="justify-content:flex-end;margin:0 0 8px"><button class="button small" data-action="copy-generated">${icon('copy')} Copy</button><button class="button small" data-action="download-generated">${icon('download')} .ino</button><button class="button small" data-action="edit-generated">${icon('pencil')} Edit</button><button class="button small" data-action="verify-generated">${icon('scan-check')} Verify</button></div><div class="code-frame"><div class="code-frame-head"><span>sketch.ino · ${esc(board)}</span><span class="code-dots"><span></span><span></span><span></span></span></div><textarea id="generatedCode" class="code-editor" spellcheck="false" aria-label="Generated Arduino code"></textarea></div><div class="result-details"><div class="detail-block"><h3>How it works</h3><p>${esc(data.explanation||'Review the code and test it with your hardware.')}</p></div><div class="detail-block"><h3>Libraries &amp; hardware</h3><p>${esc((data.libraries||[]).join(', ')||'No additional libraries listed.')} · ${esc((data.hardware||[]).join(', ')||'Check the generated connection notes.')}</p></div><div class="detail-block"><h3>Connections &amp; expected output</h3><p>${esc(data.connections||'See the board pin assignments in the sketch.')} ${esc(data.expected_output||'')}</p></div>${data.safety_warnings?.length?`<div class="board-note">${icon('triangle-alert')}<span>${esc(data.safety_warnings.join(' '))}</span></div>`:''}<button class="button small quiet" data-action="save-project">${icon('save')} Save project locally</button></div>`;
  const cppButton=document.createElement('button');cppButton.className='button small';cppButton.dataset.action='download-cpp';cppButton.innerHTML=`${icon('download')} .cpp`;result.querySelector('.code-toolbar').append(cppButton);
  $('#generationState').textContent=data.source==='sample'?'Sample project loaded; no AI request was made.':(data.source==='ai'?'AI-generated draft; compile before use.':'Generated draft; compile before use.');
  $('#generationBadge').textContent=data.source==='sample'?'SAMPLE':'DRAFT';$('#generationBadge').className='status-pill';
  setupEditor($('#generatedCode'),currentGeneratedCode);refreshIcons();
}
function setButtonLoading(button,label) { button.disabled=true;button.dataset.original=button.innerHTML;button.innerHTML=`<span class="loading"><span class="spinner"></span>${label}</span>`; }
function resetButton(button) { button.disabled=false;button.innerHTML=button.dataset.original||button.innerHTML; }
async function generate(event) {
  event.preventDefault();const form=$('#generateForm'),button=$('#generateButton'),formData=new FormData(form);
  const payload={prompt:formData.get('prompt'),board:formData.get('board'),language:formData.get('language'),components:formData.getAll('components'),pins:formData.get('pins'),requirements:formData.get('requirements')};
  setButtonLoading(button,'Generating');$('#generationState').textContent='Sending request to the backend...';
  try { const data=await apiRequest('/api/generate',payload);generatedCount++;showGenerated(data,payload.board);notify(data.source==='ai'?'AI draft generated. Review and verify before use.':'Draft generated. Review and verify before use.','success'); }
  catch(error) { notify(error.message,'error');$('#generationState').textContent='Generation unavailable. Check the backend and AI configuration.';$('#generationBadge').textContent='UNAVAILABLE'; }
  finally { resetButton(button); }
}
async function verifyCode() {
  const button=$('#verifyButton'),code=editorValue('verifyCode'),board=$('#verifyBoard').value,compile=$('#runCompile').checked;
  if(!code.trim()){notify('Add a sketch before running verification.','error');return;}
  setButtonLoading(button,'Checking');
  try {const data=await apiRequest('/api/verify',{code,board,compile});lastVerification={code,board,suggested_code:data.suggested_code};renderVerification(data);if(data.status==='PASS'&&data.compiled)verifiedCount++;notify(data.status==='PASS'?'Arduino CLI confirmed a successful compile.':`${data.status}: review the verification report.` ,data.status==='FAIL'?'error':'info');}
  catch(error){notify(error.message,'error');}
  finally{resetButton(button);}
}
function renderVerification(data) {
  const passed=data.status==='PASS',failed=data.status==='FAIL',status=data.status||'NOT VERIFIED',iconName=passed?'circle-check':failed?'circle-x':'triangle-alert',checks=data.checks||{};
  const rows=[['Static analysis',checks.static_analysis?'Completed':'No findings reported'],['Arduino CLI compilation',data.compiled?(passed?'Compilation succeeded':'Compilation failed'):(data.compiler_available===false?'Compilation unavailable':'Not run')],['Hardware behavior','Not tested']];
  $('#verificationReport').innerHTML=`<div class="verification-result"><div class="result-status"><span class="status-icon" style="background:${passed?'#17362a':failed?'#3c2225':'#302719'};color:${passed?'var(--green)':failed?'var(--red)':'var(--amber)'}">${icon(iconName)}</span><div><strong>${esc(status)}</strong><small>${esc(data.summary||'Review the detailed checks below.')}</small></div></div><p>${esc(data.compiler_available===false?'Arduino CLI is not installed or configured. Static review is not a compilation result.':data.compiled?'Arduino CLI compiled this sketch for the selected board. This does not verify hardware behavior.':'No actual compilation was performed. A static review cannot confirm that code compiles.')}</p>${data.compiler_output?`<pre class="error-list">${esc(data.compiler_output)}</pre>`:''}${(data.issues||[]).length?`<div class="error-list">${data.issues.map(issue=>esc(typeof issue==='string'?issue:`${issue.line?`Line ${issue.line}: `:''}${issue.message}`)).join('\n')}</div>`:''}${data.fix_suggestion?`<div class="detail-block" style="margin-top:10px"><h3>Suggested fix</h3><p>${esc(data.fix_suggestion)}</p>${data.suggested_code?`<button class="button small" data-action="apply-suggested" style="margin-top:8px">${icon('wand-sparkles')} Apply suggested code</button>`:''}</div>`:''}</div><div class="check-list">${rows.map(([label,value])=>`<div class="check-row ${value==='Not tested'?'pending':''}">${icon(value==='Not tested'?'circle-dashed':value.includes('failed')?'circle-x':'circle-check')}<span>${esc(label)} <span style="color:var(--muted)">· ${esc(value)}</span></span></div>`).join('')}</div>`;
  if(data.ai_review||data.ai_issues?.length){const review=document.createElement('div');review.className='detail-block';review.style.marginTop='10px';review.innerHTML=`<h3>AI review · advisory</h3><p>${esc(data.ai_review||'Review notes are listed below.')}</p>${data.ai_issues?.length?`<div class="error-list">${data.ai_issues.map(issue=>esc(`${issue.line?`Line ${issue.line}: `:''}${issue.message}`)).join('\n')}</div>`:''}`;$('#verificationReport .verification-result').append(review);}
  refreshIcons();
}
async function debugCode() {
  const button=$('#debugButton'),file=$('#debugUpload').files[0];let code=editorValue('debugOriginal');
  if(!code.trim()&&file){if(file.size>200000) {notify('File is too large (maximum 200 KB).','error');return;}code=await file.text();setEditorValue('debugOriginal',code);}
  if(!code.trim()){notify('Paste code or select a sketch file first.','error');return;}
  setButtonLoading(button,'Reviewing');
  try {const data=await apiRequest('/api/debug',{code,problem:$('#debugProblem').value,board:$('#verifyBoard')?.value||'Arduino Uno'});setEditorValue('debugFixed',data.corrected_code||'');$('#debugExplanation').innerHTML=`<div class="result-details"><div class="detail-block"><h3>What to check</h3><p>${esc(data.explanation||'Review the suggested code and verify it for your target board.')}</p></div><div class="detail-block"><h3>Suggested solution</h3><p>${esc(data.solution||'Compare the correction with the original before applying.')}</p></div></div>`;$('#applyFixButton').disabled=!(data.corrected_code);refreshIcons();notify('Review the suggested correction before applying it.','success');}
  catch(error){notify(error.message,'error');}
  finally{resetButton(button);}
}
async function explainCode() {
  const code=editorValue('debugOriginal');if(!code.trim()){notify('Add code to explain first.','error');return;}
  try{const data=await apiRequest('/api/explain',{code});$('#debugExplanation').innerHTML=`<div class="result-details"><div class="detail-block"><h3>Beginner-friendly explanation</h3><div class="explanation-list">${(data.lines||[]).map(item=>`<div class="explanation-item"><span class="line-number">${esc(item.line||'')}</span><p><code>${esc(item.code||'')}</code><br>${esc(item.explanation||'')}</p></div>`).join('')||`<p>${esc(data.explanation||'No explanation returned.')}</p>`}</div></div></div>`;}
  catch(error){notify(error.message,'error');}
}
async function handleAction(event) {
  const nav=event.target.closest('[data-view]');if(nav){event.preventDefault();setPage(nav.dataset.view);return;}
  const go=event.target.closest('[data-go]');if(go){setPage(go.dataset.go);return;}
  const verifyProject=event.target.closest('[data-verify-project]');if(verifyProject){const project=projectForPrompt(verifyProject.dataset.verifyProject);if(project){setPage('verifier');$('#verifyBoard').value=project.category==='ESP32'?'ESP32':'Arduino Uno';setEditorValue('verifyCode',project.code);}return;}
  const load=event.target.closest('[data-load-project]');if(load){const project=projectForPrompt(load.dataset.loadProject);if(project){currentGeneratedCode=project.code;setPage('generator');$('#prompt').value=`${project.title}: ${project.description}`;showGenerated({code:project.code,source:'sample',explanation:project.description,libraries:(project.code.match(/#include <([^>]+)>/g)||[]).map(value=>value.slice(10,-1)),hardware:[project.components],connections:'Confirm the pin mapping and voltage levels for your board before wiring.',expected_output:'See the project description.'},project.category==='ESP32'?'ESP32':'Arduino Uno');}return;}
  const openSaved=event.target.closest('[data-open-saved]');if(openSaved){const item=getSaved().find(project=>project.id===openSaved.dataset.openSaved);if(item){currentGeneratedCode=item.code;setPage('generator');$('#prompt').value=item.prompt||item.name;showGenerated({code:item.code,source:'sample',explanation:'Saved local sketch.',hardware:[item.board]},item.board);}return;}
  const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;
  if(action==='load-sample'){setEditorValue('verifyCode',PROJECTS[0].code);notify('LED blink example loaded.','success');}
  if(action==='verify-generated'){setPage('verifier');setEditorValue('verifyCode',currentGeneratedCode);}
  if(action==='copy-generated'){try{await navigator.clipboard.writeText(editorValue('generatedCode'));notify('Code copied to clipboard.','success');}catch{notify('Clipboard access is not available in this browser.','error');}}
  if(action==='download-generated')downloadCode(editorValue('generatedCode'));
  if(action==='download-cpp')downloadCode(editorValue('generatedCode'),'sketch.cpp');
  if(action==='edit-generated'){const cm=$('#generatedCode')?.CodeMirror;if(cm){cm.setOption('readOnly',false);cm.focus();notify('Editor is ready for changes.','success');}}
  if(action==='save-project'){const name=$('#prompt')?.value.trim()||'Untitled sketch',projects=getSaved();projects.unshift({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),name,code:editorValue('generatedCode'),board:$('#board')?.value||'Arduino Uno',prompt:name,savedAt:new Date().toISOString()});localStorage.setItem('makermind-projects',JSON.stringify(projects.slice(0,40)));notify('Project saved in this browser.','success');}
  if(action==='apply-suggested'&&lastVerification?.suggested_code){setEditorValue('verifyCode',lastVerification.suggested_code);}
}
document.addEventListener('click',handleAction);
document.addEventListener('submit',event=>{if(event.target.id==='generateForm')generate(event);});
document.addEventListener('click',event=>{if(event.target.closest('#verifyButton'))verifyCode();if(event.target.closest('#debugButton'))debugCode();if(event.target.closest('#explainButton'))explainCode();if(event.target.closest('#applyFixButton')){const code=editorValue('debugFixed');if(code){setPage('verifier');setEditorValue('verifyCode',code);notify('Suggested code copied to verifier. Run checks before uploading.','success');}}});
$('#themeToggle').addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=next;localStorage.setItem('makermind-theme',next);$('#themeToggle').innerHTML=icon(next==='light'?'moon':'sun');if(editor)editor.setOption('theme',next==='light'?'default':'material-darker');document.querySelectorAll('.CodeMirror').forEach(cm=>{const instance=cm.CodeMirror;if(instance)instance.setOption('theme',next==='light'?'default':'material-darker');});refreshIcons();});
$('#mobileMenu').addEventListener('click',()=>{$('#sidebar').classList.add('open');$('#mobileScrim').classList.add('show');});
$('#mobileScrim').addEventListener('click',closeMobileNav);
document.addEventListener('change',event=>{if(event.target.id==='debugUpload'&&event.target.files[0]){const file=event.target.files[0];if(file.size>200000){event.target.value='';notify('File is too large (maximum 200 KB).','error');return;}file.text().then(code=>setEditorValue('debugOriginal',code));}});
const savedTheme=localStorage.getItem('makermind-theme');if(savedTheme==='light')document.documentElement.dataset.theme='light';
window.addEventListener('hashchange',()=>{const view=location.hash.slice(1);if(views[view]&&view!==currentView)setPage(view);});
setPage(views[location.hash.slice(1)]?location.hash.slice(1):'overview');