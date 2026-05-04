(function(){
'use strict';
const DB='workmitra_data';
const SESSION='workmitra_session';
let state=load();
function defaults(){return{onboarded:false,phone:'',businessName:'',ownerName:'',businessType:'',email:'',address:'',city:'',bizState:'',pincode:'',gst:'',employees:[],attendance:{},tasks:[],wages:[],leaves:[],permissions:{leaveApproval:['owner'],salaryPayout:['owner'],reports:['owner']}}}
function ensureEmpDefaults(e){if(!e.status)e.status='active';if(!e.accessRole)e.accessRole=null;return e}
function load(){try{const r=localStorage.getItem(DB);if(r){const d={...defaults(),...JSON.parse(r)};d.employees=(d.employees||[]).map(ensureEmpDefaults);if(!d.permissions)d.permissions={leaveApproval:[],salaryPayout:[],reports:[]};
      // Migrate old single-ID permissions to arrays
      ['leaveApproval','salaryPayout','reports'].forEach(k=>{if(d.permissions[k]&&!Array.isArray(d.permissions[k])){d.permissions[k]=d.permissions[k]?[d.permissions[k]]:[];}if(!d.permissions[k])d.permissions[k]=[];});return d}}catch(e){}return defaults()}
function save(){localStorage.setItem(DB,JSON.stringify(state))}
function saveSession(role,empId){localStorage.setItem(SESSION,JSON.stringify({role,empId:empId||null}))}
function clearSession(){localStorage.removeItem(SESSION)}
function getSession(){try{return JSON.parse(localStorage.getItem(SESSION))}catch(e){return null}}
function id(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
function avatarCls(i){let h=0;for(let c=0;c<i.length;c++)h=(h*31+i.charCodeAt(c))%10;return'avatar-'+h}
function ini(n){const p=n.trim().split(/\s+/);return p.length>=2?(p[0][0]+p[1][0]).toUpperCase():n.slice(0,2).toUpperCase()}
function fmtDate(d){return new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
function localDateStr(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function today(){return localDateStr(new Date())}
function isOverdue(t){return t.status==='pending'&&t.dueDate&&t.dueDate<today()}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function hasPerm(key,empId){return Array.isArray(state.permissions[key])&&state.permissions[key].includes(empId)}
function daysBetween(f,t){const days=[],d=new Date(f+'T00:00:00'),end=new Date(t+'T00:00:00');while(d<=end){days.push(localDateStr(d));d.setDate(d.getDate()+1)}return days}

// Toast - at top, auto-dismiss
let toastTimer=null;
function toast(msg){const t=$('#toast');if(toastTimer){clearTimeout(toastTimer);toastTimer=null}t.textContent=msg;t.classList.remove('show');void t.offsetWidth;t.classList.add('show');toastTimer=setTimeout(()=>{t.classList.remove('show');toastTimer=null},2200)}

function downloadCSV(fn,csv){const b=new Blob([csv],{type:'text/csv;charset=utf-8;'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=fn;a.click();URL.revokeObjectURL(u)}

// ===== SCREEN NAV =====
function showScreen(id){$$('.screen').forEach(s=>s.classList.remove('active'));$('#'+id).classList.add('active')}

// ===== ROLE SELECT =====
$('#role-owner').addEventListener('click',()=>{
  if(state.onboarded){saveSession('owner');showScreen('screen-main');initOwnerApp();return}
  showScreen('screen-onboard-phone')
});
$('#role-employee').addEventListener('click',()=>showScreen('screen-emp-login'));

// ===== OWNER ONBOARDING =====
const phoneIn=$('#phone-input'),btnOtp=$('#btn-send-otp');
phoneIn.addEventListener('input',()=>{phoneIn.value=phoneIn.value.replace(/\D/g,'');btnOtp.disabled=phoneIn.value.length<10});
btnOtp.addEventListener('click',()=>{state.phone=phoneIn.value;$('#otp-subtitle').textContent='Sent to +91 '+state.phone;showScreen('screen-onboard-otp');$$('.otp-box')[0].focus()});

const otpBoxes=$$('.otp-box');
otpBoxes.forEach((b,i)=>{
  b.addEventListener('input',()=>{b.value=b.value.replace(/\D/g,'').slice(0,1);if(b.value&&i<otpBoxes.length-1)otpBoxes[i+1].focus();$('#btn-verify-otp').disabled=!Array.from(otpBoxes).every(x=>x.value.length===1)});
  b.addEventListener('keydown',e=>{if(e.key==='Backspace'&&!b.value&&i>0)otpBoxes[i-1].focus()})
});
$('#btn-verify-otp').addEventListener('click',()=>{showScreen('screen-onboard-business');$('#business-name').focus()});
$('#resend-otp').addEventListener('click',e=>{e.preventDefault();toast('OTP resent!')});
$$('[data-back]').forEach(b=>b.addEventListener('click',()=>showScreen(b.dataset.back)));

const bizIn=$('#business-name'),ownIn=$('#owner-name'),btnStart=$('#btn-start');
function chkBiz(){btnStart.disabled=!(bizIn.value.trim()&&ownIn.value.trim())}
bizIn.addEventListener('input',chkBiz);ownIn.addEventListener('input',chkBiz);
btnStart.addEventListener('click',()=>{state.businessName=bizIn.value.trim();state.ownerName=ownIn.value.trim();state.onboarded=true;save();saveSession('owner');showScreen('screen-main');initOwnerApp()});

// ===== EMPLOYEE LOGIN =====
const empLoginPhone=$('#emp-login-phone'),btnEmpLogin=$('#btn-emp-login');
empLoginPhone.addEventListener('input',()=>{empLoginPhone.value=empLoginPhone.value.replace(/\D/g,'');btnEmpLogin.disabled=empLoginPhone.value.length<10;$('#emp-login-error').style.display='none'});
btnEmpLogin.addEventListener('click',()=>{
  const ph=empLoginPhone.value;
  const emp=state.employees.find(e=>e.phone===ph);
  if(!emp){$('#emp-login-error').style.display='';return}
  currentEmpId=emp.id;
  saveSession('employee',emp.id);
  showScreen('screen-emp-main');
  initEmployeeApp(emp);
});

// ===== INIT ON LOAD =====
function initOnLoad(){
  const session=getSession();
  if(session&&session.role==='owner'&&state.onboarded){
    showScreen('screen-main');initOwnerApp();return;
  }
  if(session&&session.role==='employee'&&session.empId){
    const emp=state.employees.find(e=>e.id===session.empId);
    if(emp){currentEmpId=emp.id;showScreen('screen-emp-main');initEmployeeApp(emp);return}
  }
  showScreen('screen-role-select');
}

// ===== OWNER APP =====
function initOwnerApp(){
  $('#header-business-name').textContent=state.businessName;
  renderDashboard();renderEmployees();renderAttendance();renderTasks();renderLeaves();updateSummary();initReportDefaults();updateDropdowns();
}

// Tab nav
$$('.nav-item[data-tab]').forEach(b=>b.addEventListener('click',()=>{
  b.closest('.bottom-nav').querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  $$('#screen-main .tab-panel').forEach(p=>p.classList.remove('active'));
  $('#tab-'+b.dataset.tab).classList.add('active');
}));

// Sub-tabs
$$('.sub-tab').forEach(b=>b.addEventListener('click',()=>{
  $$('.sub-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');
  $$('.sub-panel').forEach(p=>p.classList.remove('active'));$('#subtab-'+b.dataset.subtab).classList.add('active');
}));

function activeEmps(){return state.employees.filter(e=>e.status!=='exited')}
function updateDropdowns(){
  const active=activeEmps();
  const opts='<option value="">Select employee</option>'+active.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('');
  const optsAll='<option value="all">All Employees</option>'+state.employees.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('');
  $('#task-assignee').innerHTML=opts;$('#leave-employee').innerHTML=opts;$('#att-report-emp').innerHTML=optsAll;$('#leave-report-emp').innerHTML=optsAll;
}

// ===== EMPLOYEES =====
let empStatusFilter='active';
function renderEmployees(){
  const emps=state.employees,search=($('#emp-search')?.value||'').toLowerCase();
  let filtered=emps;
  if(empStatusFilter==='active')filtered=filtered.filter(e=>e.status!=='exited');
  else if(empStatusFilter==='exited')filtered=filtered.filter(e=>e.status==='exited');
  if(search)filtered=filtered.filter(e=>e.name.toLowerCase().includes(search)||(e.role||'').toLowerCase().includes(search));
  if(emps.length===0){$('#employees-empty').style.display='';$('#employees-list-container').style.display='none';return}
  $('#employees-empty').style.display='none';$('#employees-list-container').style.display='';
  const activeCount=emps.filter(e=>e.status!=='exited').length;
  $('#emp-count').textContent=activeCount+' active employee'+(activeCount!==1?'s':'');
  const list=$('#employees-list');
  list.innerHTML=filtered.map(e=>{const isExited=e.status==='exited';const roleBadge=e.accessRole?`<span class="access-role-badge">${e.accessRole}</span>`:'';const exitBadge=isExited?'<span class="exited-badge">EXITED</span>':'';return`<div class="emp-card${isExited?' exited':''}" data-id="${e.id}"><div class="emp-avatar ${avatarCls(e.id)}">${ini(e.name)}</div><div class="emp-info"><div class="emp-name">${esc(e.name)}${exitBadge}${roleBadge}</div><div class="emp-role">${esc(e.role||'No role')}</div></div><span class="emp-chevron">&#8250;</span></div>`}).join('');
  list.querySelectorAll('.emp-card').forEach(c=>c.addEventListener('click',()=>showEmpDetail(c.dataset.id)));
}
$('#emp-search')?.addEventListener('input',renderEmployees);
$$('[data-emp-status-filter]').forEach(c=>c.addEventListener('click',()=>{$$('[data-emp-status-filter]').forEach(x=>x.classList.remove('active'));c.classList.add('active');empStatusFilter=c.dataset.empStatusFilter;renderEmployees()}));

function showEmpDetail(eid){
  const emp=state.employees.find(e=>e.id===eid);if(!emp)return;ensureEmpDefaults(emp);
  const wages=state.wages.filter(w=>w.empId===eid).sort((a,b)=>b.month.localeCompare(a.month));
  const isExited=emp.status==='exited';
  // Derive permissions for display
  const permLabels=[];
  if(hasPerm('leaveApproval',eid))permLabels.push('Leave Approval');
  if(hasPerm('salaryPayout',eid))permLabels.push('Salary Payout');
  if(hasPerm('reports',eid))permLabels.push('Reports');
  const body=$('#emp-detail-body');
  body.innerHTML=`
    <div class="emp-detail-header"><div class="emp-detail-avatar ${avatarCls(emp.id)}">${ini(emp.name)}</div><div class="emp-detail-name">${esc(emp.name)}${isExited?'<span class="exited-badge" style="margin-left:8px">EXITED</span>':''}</div><div class="emp-detail-role">${esc(emp.role||'No role')}</div>${permLabels.length?`<div style="margin-top:6px">${permLabels.map(l=>`<span class="access-role-badge" style="margin:2px">${l}</span>`).join('')}</div>`:''}</div>
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-item-label">Phone</div><div class="detail-item-value">${emp.phone?'+91 '+emp.phone:'—'}</div></div>
      <div class="detail-item"><div class="detail-item-label">Joining Date</div><div class="detail-item-value">${emp.joiningDate?fmtDate(emp.joiningDate):'—'}</div></div>
      <div class="detail-item"><div class="detail-item-label">Monthly Wage</div><div class="detail-item-value">${emp.wage?'₹'+Number(emp.wage).toLocaleString('en-IN'):'—'}</div></div>
      ${isExited?`<div class="detail-item"><div class="detail-item-label">Exit Date</div><div class="detail-item-value">${emp.exitDate?fmtDate(emp.exitDate):'—'}</div></div><div class="detail-item"><div class="detail-item-label">Exit Reason</div><div class="detail-item-value">${emp.exitReason?esc(emp.exitReason):'—'}</div></div>`:''}
    </div>
    ${(emp.doc_aadhaar||emp.doc_pan)?`<div style="padding:0 0 8px"><div class="detail-item-label" style="margin-bottom:8px">DOCUMENTS</div><div style="display:flex;gap:8px">${emp.doc_aadhaar?`<a href="${emp.doc_aadhaar}" target="_blank" class="doc-view-btn"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Aadhaar Card</a>`:''}${emp.doc_pan?`<a href="${emp.doc_pan}" target="_blank" class="doc-view-btn"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> PAN Card</a>`:''}${(!emp.doc_aadhaar||!emp.doc_pan)?`<span style="font-size:12px;color:var(--text-tertiary);align-self:center">${!emp.doc_aadhaar&&!emp.doc_pan?'':'Missing: '}${!emp.doc_aadhaar?'Aadhaar':''}${!emp.doc_aadhaar&&!emp.doc_pan?' & ':''}${!emp.doc_pan?'PAN':''}</span>`:''}</div></div>`:`<div style="padding:0 0 8px"><div class="detail-item-label" style="margin-bottom:4px">DOCUMENTS</div><span style="font-size:13px;color:var(--text-tertiary)">No documents uploaded. Edit employee to add.</span></div>`}
    <div class="detail-actions">
      <button class="detail-action-btn" data-act="edit"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit Employee</button>
      <button class="detail-action-btn" data-act="att"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Attendance History</button>
      <button class="detail-action-btn" data-act="wage"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>Log Wage Payment</button>
      ${wages.length?`<div style="margin-top:8px"><div class="detail-item-label" style="margin-bottom:8px">RECENT WAGES</div>${wages.slice(0,3).map(w=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-light);font-size:14px"><span>${w.month}</span><span style="font-weight:600">₹${Number(w.amount).toLocaleString('en-IN')}</span><span class="task-status-badge ${w.status==='paid'?'done':'overdue'}">${w.status}</span></div>`).join('')}</div>`:''}
      ${!isExited?`<button class="detail-action-btn" data-act="exit" style="color:var(--warning)"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>Mark as Exited</button>`:''}
      <button class="detail-action-btn" data-act="offer-letter"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Offer Letter</button>
      ${isExited?`<button class="detail-action-btn" data-act="relieving-letter"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>Relieving Letter</button>`:''}
      <button class="detail-action-btn danger" data-act="delete"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Delete Employee</button>
    </div>`;
  body.querySelector('[data-act="edit"]').addEventListener('click',()=>{closeSheet('sheet-emp-detail');openEditEmp(emp)});
  body.querySelector('[data-act="att"]').addEventListener('click',()=>{closeSheet('sheet-emp-detail');showAttHistory(emp)});
  body.querySelector('[data-act="wage"]').addEventListener('click',()=>{closeSheet('sheet-emp-detail');openWage(emp)});
  const exitBtn=body.querySelector('[data-act="exit"]');
  if(exitBtn)exitBtn.addEventListener('click',()=>{closeSheet('sheet-emp-detail');openExitSheet(emp)});
  body.querySelector('[data-act="offer-letter"]').addEventListener('click',()=>{closeSheet('sheet-emp-detail');showOfferLetter(emp)});
  const relBtn=body.querySelector('[data-act="relieving-letter"]');
  if(relBtn)relBtn.addEventListener('click',()=>{closeSheet('sheet-emp-detail');showRelievingLetter(emp)});
  body.querySelector('[data-act="delete"]').addEventListener('click',()=>{
    if(confirm('Delete '+emp.name+'?')){
      state.employees=state.employees.filter(e=>e.id!==eid);state.tasks=state.tasks.filter(t=>t.assigneeId!==eid);
      Object.keys(state.attendance).forEach(d=>delete(state.attendance[d]||{})[eid]);
      state.wages=state.wages.filter(w=>w.empId!==eid);state.leaves=state.leaves.filter(l=>l.empId!==eid);
      // Clean up permissions
      Object.keys(state.permissions).forEach(k=>{if(Array.isArray(state.permissions[k]))state.permissions[k]=state.permissions[k].filter(id=>id!==eid)});
      save();closeSheet('sheet-emp-detail');renderEmployees();renderAttendance();renderTasks();renderLeaves();updateSummary();updateDropdowns();toast('Employee deleted');
    }
  });
  openSheet('sheet-emp-detail');
}

function resetDocUploadUI(){
  ['aadhaar','pan'].forEach(t=>{
    $('#emp-'+t).value='';
    $('#'+t+'-upload-label').classList.remove('has-file');
    $('#'+t+'-upload-status').textContent='';
    $('#'+t+'-upload-name').textContent=t==='aadhaar'?'Aadhaar Card':'PAN Card';
  });
}
function setDocUploadFromEmp(emp){
  ['aadhaar','pan'].forEach(t=>{
    const val=emp['doc_'+t];
    const label=$('#'+t+'-upload-label');
    const status=$('#'+t+'-upload-status');
    if(val){label.classList.add('has-file');status.textContent='✓ Uploaded';}
    else{label.classList.remove('has-file');status.textContent='';}
  });
}
function openAddEmp(){
  $('#sheet-emp-title').textContent='Add Employee';$('#emp-edit-id').value='';$('#emp-name').value='';$('#emp-role').value='';$('#emp-phone').value='';$('#emp-joining').value='';$('#emp-wage').value='';
  resetDocUploadUI();
  $('#emp-optional-fields').style.display='none';$('#toggle-emp-optional').textContent='+ More details (optional)';openSheet('sheet-employee');setTimeout(()=>$('#emp-name').focus(),300)
}
function openEditEmp(e){
  $('#sheet-emp-title').textContent='Edit Employee';$('#emp-edit-id').value=e.id;$('#emp-name').value=e.name;$('#emp-role').value=e.role||'';$('#emp-phone').value=e.phone||'';$('#emp-joining').value=e.joiningDate||'';$('#emp-wage').value=e.wage||'';
  resetDocUploadUI();setDocUploadFromEmp(e);
  if(e.joiningDate||e.wage||e.doc_aadhaar||e.doc_pan){$('#emp-optional-fields').style.display='';$('#toggle-emp-optional').textContent='- Hide details'}
  openSheet('sheet-employee')
}

// File input handlers for doc uploads
function setupDocInput(inputId,labelId,statusId,fieldKey){
  $(inputId).addEventListener('change',function(){
    if(!this.files[0])return;
    const reader=new FileReader();
    reader.onload=ev=>{
      // Store as base64 on the pending employee object (applied on submit)
      $(inputId).dataset.dataUrl=ev.target.result;
      $(labelId).classList.add('has-file');
      $(statusId).textContent='✓ '+this.files[0].name.slice(0,16)+(this.files[0].name.length>16?'…':'');
    };
    reader.readAsDataURL(this.files[0]);
  });
}
setupDocInput('#emp-aadhaar','#aadhaar-upload-label','#aadhaar-upload-status','doc_aadhaar');
setupDocInput('#emp-pan','#pan-upload-label','#pan-upload-status','doc_pan');

$('#btn-add-first-emp').addEventListener('click',openAddEmp);$('#btn-add-emp').addEventListener('click',openAddEmp);$('#btn-cancel-emp').addEventListener('click',()=>closeSheet('sheet-employee'));
$('#toggle-emp-optional').addEventListener('click',()=>{const f=$('#emp-optional-fields'),b=$('#toggle-emp-optional');if(f.style.display==='none'){f.style.display='';b.textContent='- Hide details'}else{f.style.display='none';b.textContent='+ More details (optional)'}});
$('#form-employee').addEventListener('submit',e=>{
  e.preventDefault();
  const eid=$('#emp-edit-id').value;
  const d={name:$('#emp-name').value.trim(),role:$('#emp-role').value.trim(),phone:$('#emp-phone').value.trim(),joiningDate:$('#emp-joining').value,wage:$('#emp-wage').value};
  if(!d.name)return;
  // Attach uploaded docs if new ones were selected
  if($('#emp-aadhaar').dataset.dataUrl)d.doc_aadhaar=$('#emp-aadhaar').dataset.dataUrl;
  if($('#emp-pan').dataset.dataUrl)d.doc_pan=$('#emp-pan').dataset.dataUrl;
  if(eid){const emp=state.employees.find(x=>x.id===eid);if(emp)Object.assign(emp,d);toast('Employee updated')}
  else{state.employees.push(ensureEmpDefaults({id:id(),...d}));toast('Employee added!')}
  save();closeSheet('sheet-employee');renderEmployees();renderAttendance();updateDropdowns();updateSummary();renderDashboard();
});

// ===== ATTENDANCE =====
let attDate=today();
function renderAttendance(){
  if(!state.employees.length){$('#attendance-empty').style.display='';$('#attendance-content').style.display='none';return}
  $('#attendance-empty').style.display='none';$('#attendance-content').style.display='';
  const d=new Date(attDate+'T00:00:00'),td=today();
  if(attDate===td)$('#att-date-display').textContent='Today';
  else{const y=new Date();y.setDate(y.getDate()-1);$('#att-date-display').textContent=attDate===localDateStr(y)?'Yesterday':d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}
  $('#att-date-sub').textContent=d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
  const isFuture=attDate>td;
  $('#att-next-day').disabled=attDate>=td;$('#att-date-picker').value=attDate;
  const active=activeEmps();
  const dd=state.attendance[attDate]||{},total=active.length,marked=active.filter(e=>dd[e.id]).length;
  const pct=total?Math.round(marked/total*100):0;$('#att-progress-fill').style.width=pct+'%';$('#att-progress-text').textContent=marked+' of '+total+' marked';
  const appLeaves={};state.leaves.filter(l=>l.status==='approved').forEach(l=>{if(daysBetween(l.fromDate,l.toDate).includes(attDate))appLeaves[l.empId]=l.type});
  const list=$('#attendance-list');
  list.innerHTML=active.map(emp=>{const s=dd[emp.id]||'',ol=appLeaves[emp.id];return`<div class="att-row" data-id="${emp.id}"><div class="emp-avatar ${avatarCls(emp.id)}" style="width:36px;height:36px;font-size:13px">${ini(emp.name)}</div><div style="flex:1;min-width:0"><span class="att-name">${esc(emp.name)}</span>${ol?`<span class="att-leave-tag">${ol} leave</span>`:''}</div><div class="att-buttons"><button class="att-btn ${s==='P'?'present':''}" data-s="P">P</button><button class="att-btn ${s==='A'?'absent':''}" data-s="A">A</button><button class="att-btn ${s==='H'?'half':''}" data-s="H">H</button></div></div>`}).join('');
  list.querySelectorAll('.att-btn').forEach(btn=>btn.addEventListener('click',()=>{
    const eid=btn.closest('.att-row').dataset.id,ns=btn.dataset.s;
    if(!state.attendance[attDate])state.attendance[attDate]={};
    if(state.attendance[attDate][eid]===ns)delete state.attendance[attDate][eid];else state.attendance[attDate][eid]=ns;
    save();renderAttendance();updateSummary();
  }));
}
$('#att-prev-day').addEventListener('click',()=>{const d=new Date(attDate+'T00:00:00');d.setDate(d.getDate()-1);attDate=localDateStr(d);renderAttendance()});
$('#att-next-day').addEventListener('click',()=>{const d=new Date(attDate+'T00:00:00');d.setDate(d.getDate()+1);const newDate=localDateStr(d);if(newDate<=today()){attDate=newDate;renderAttendance()}});

// Date picker - tap on date display
$('#att-date-tap').addEventListener('click',()=>{const dp=$('#att-date-picker');dp.style.position='fixed';dp.style.opacity='0';dp.style.pointerEvents='auto';try{dp.showPicker()}catch(e){dp.click()}});
$('#att-date-picker').addEventListener('change',e=>{const v=e.target.value;if(v&&v<=today()){attDate=v;renderAttendance()}e.target.style.pointerEvents='none'});

function showAttHistory(emp){
  $('#att-history-title').textContent=emp.name+' - Attendance';const body=$('#att-history-body'),td=new Date(),days=[];
  for(let i=29;i>=0;i--){const d=new Date(td);d.setDate(d.getDate()-i);const ds=localDateStr(d);days.push({date:d,dateStr:ds,status:(state.attendance[ds]||{})[emp.id]||null})}
  let p=0,a=0,h=0;days.forEach(d=>{if(d.status==='P')p++;else if(d.status==='A')a++;else if(d.status==='H')h++});
  body.innerHTML=`<div class="att-history-stats"><div class="att-stat"><div class="att-stat-dot" style="background:var(--accent)"></div>Present: ${p}</div><div class="att-stat"><div class="att-stat-dot" style="background:var(--danger)"></div>Absent: ${a}</div><div class="att-stat"><div class="att-stat-dot" style="background:var(--warning)"></div>Half: ${h}</div></div><div style="padding:8px 0">${days.map(d=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light)"><span style="font-size:14px;color:var(--text-secondary);width:120px">${d.date.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</span><span class="att-history-cell ${d.status==='P'?'present':d.status==='A'?'absent':d.status==='H'?'half':''}">${d.status==='P'?'Present':d.status==='A'?'Absent':d.status==='H'?'Half Day':'—'}</span></div>`).join('')}</div>`;
  openSheet('sheet-att-history');
}

// ===== LEAVES =====
let leaveFilter='all';
function renderLeaves(){
  const leaves=state.leaves;
  if(!leaves.length){$('#leaves-empty').style.display='';$('#leaves-list-container').style.display='none';return}
  $('#leaves-empty').style.display='none';$('#leaves-list-container').style.display='';
  let f=leaveFilter==='all'?leaves:leaves.filter(l=>l.status===leaveFilter);
  f=[...f].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const list=$('#leaves-list');
  list.innerHTML=f.map(l=>{const emp=state.employees.find(e=>e.id===l.empId);return`<div class="leave-card ${l.status}" data-id="${l.id}"><div class="leave-card-header"><div><div class="leave-emp-name">${emp?esc(emp.name):'Unknown'}</div><span class="leave-type-badge">${l.type} leave</span></div><span class="task-status-badge ${l.status}">${l.status}</span></div><div class="leave-card-meta"><span>${fmtDate(l.fromDate)} — ${fmtDate(l.toDate)}</span>${l.reason?`<span>${esc(l.reason)}</span>`:''}</div></div>`}).join('');
  list.querySelectorAll('.leave-card').forEach(c=>c.addEventListener('click',()=>showLeaveDetail(c.dataset.id)));
}
$$('[data-leave-filter]').forEach(c=>c.addEventListener('click',()=>{$$('[data-leave-filter]').forEach(x=>x.classList.remove('active'));c.classList.add('active');leaveFilter=c.dataset.leaveFilter;renderLeaves()}));

function openLeaveSheet(empId,isEmployee){
  $('#sheet-leave-title').textContent='Request Leave';$('#leave-emp-id-hidden').value=empId||'';
  if(empId){$('#leave-emp-select-wrap').style.display='none'}else{$('#leave-emp-select-wrap').style.display='';updateDropdowns()}
  $('#leave-type').value='casual';$('#leave-from').value=today();$('#leave-to').value=today();$('#leave-reason').value='';openSheet('sheet-leave');
}
$('#btn-add-leave').addEventListener('click',()=>{updateDropdowns();openLeaveSheet(null,false)});
$('#btn-add-leave-empty').addEventListener('click',()=>{updateDropdowns();openLeaveSheet(null,false)});
$('#btn-cancel-leave').addEventListener('click',()=>closeSheet('sheet-leave'));
$('#form-leave').addEventListener('submit',e=>{
  e.preventDefault();const empId=$('#leave-emp-id-hidden').value||$('#leave-employee').value;
  const type=$('#leave-type').value,from=$('#leave-from').value,to=$('#leave-to').value,reason=$('#leave-reason').value.trim();
  if(!empId||!from||!to){toast('Please fill all required fields');return}
  if(to<from){toast('To date must be after From date');return}
  state.leaves.push({id:id(),empId,type,fromDate:from,toDate:to,reason,status:'pending',createdAt:today()});
  save();closeSheet('sheet-leave');renderLeaves();if(currentEmpId)renderEmpLeaves();toast('Leave request submitted');
});

function showLeaveDetail(lid){
  const leave=state.leaves.find(l=>l.id===lid);if(!leave)return;
  const emp=state.employees.find(e=>e.id===leave.empId),days=daysBetween(leave.fromDate,leave.toDate).length;
  // Check if current user is owner or has leave approval permission
  const isOwner=!currentEmpId||(getSession()&&getSession().role==='owner');
  const hasLeavePermission=currentEmpId&&hasPerm('leaveApproval',currentEmpId);
  const canManageLeave=isOwner||hasLeavePermission;
  const body=$('#leave-detail-body');
  body.innerHTML=`<h3 class="sheet-title">Leave Request</h3><div class="task-detail-info" style="border-top:none;padding-top:0"><div class="task-detail-row"><span class="task-detail-label">Employee</span><span class="task-detail-value">${emp?esc(emp.name):'Unknown'}</span></div><div class="task-detail-row"><span class="task-detail-label">Type</span><span class="task-detail-value" style="text-transform:capitalize">${leave.type} Leave</span></div><div class="task-detail-row"><span class="task-detail-label">From</span><span class="task-detail-value">${fmtDate(leave.fromDate)}</span></div><div class="task-detail-row"><span class="task-detail-label">To</span><span class="task-detail-value">${fmtDate(leave.toDate)}</span></div><div class="task-detail-row"><span class="task-detail-label">Duration</span><span class="task-detail-value">${days} day${days!==1?'s':''}</span></div>${leave.reason?`<div class="task-detail-row"><span class="task-detail-label">Reason</span><span class="task-detail-value">${esc(leave.reason)}</span></div>`:''}<div class="task-detail-row"><span class="task-detail-label">Status</span><span class="task-status-badge ${leave.status}">${leave.status}</span></div></div><div class="task-detail-actions">${canManageLeave&&leave.status==='pending'?'<button class="btn btn-accent" data-act="approve">Approve</button><button class="btn btn-danger-outline" data-act="reject">Reject</button>':''}${canManageLeave&&leave.status==='approved'?'<button class="btn btn-warning" data-act="revoke">Revoke</button>':''}${canManageLeave&&leave.status==='rejected'?'<button class="btn btn-accent" data-act="approve">Approve</button>':''}${canManageLeave?'<button class="btn btn-ghost" data-act="delete">Delete</button>':''}</div>`;
  body.querySelectorAll('[data-act]').forEach(btn=>btn.addEventListener('click',()=>{
    const a=btn.dataset.act;
    if(a==='approve'){leave.status='approved';toast('Leave approved')}
    else if(a==='reject'){leave.status='rejected';toast('Leave rejected')}
    else if(a==='revoke'){leave.status='pending';toast('Leave revoked')}
    else if(a==='delete'){if(!confirm('Delete this leave?'))return;state.leaves=state.leaves.filter(l=>l.id!==lid);toast('Leave deleted')}
    save();closeSheet('sheet-leave-detail');renderLeaves();renderAttendance();if(currentEmpId)renderEmpLeaves();
  }));
  openSheet('sheet-leave-detail');
}

// ===== TASKS =====
let taskFilter='all';
function renderTasks(){
  let tasks=[...state.tasks];tasks.forEach(t=>{t.displayStatus=t.status==='pending'&&t.dueDate&&t.dueDate<today()?'overdue':t.status});
  if(!tasks.length){$('#tasks-empty').style.display='';$('#tasks-list-container').style.display='none';return}
  $('#tasks-empty').style.display='none';$('#tasks-list-container').style.display='';
  let f=tasks;if(taskFilter==='pending')f=tasks.filter(t=>t.displayStatus==='pending');else if(taskFilter==='done')f=tasks.filter(t=>t.status==='done');else if(taskFilter==='overdue')f=tasks.filter(t=>t.displayStatus==='overdue');
  f.sort((a,b)=>{const o={overdue:0,pending:1,done:2};return(o[a.displayStatus]||1)-(o[b.displayStatus]||1)||(a.dueDate||'9999').localeCompare(b.dueDate||'9999')});
  const list=$('#tasks-list');
  list.innerHTML=f.map(t=>{const emp=state.employees.find(e=>e.id===t.assigneeId),sc=t.displayStatus;const creator=t.createdBy==='owner'?state.ownerName:(state.employees.find(e=>e.id===t.createdBy)||{}).name;return`<div class="task-card ${sc}" data-id="${t.id}"><div class="task-title-row"><span class="task-title">${esc(t.title)}</span><span class="task-status-badge ${sc}">${sc}</span></div><div class="task-meta"><span class="task-meta-item"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${emp?esc(emp.name):'Unassigned'}</span>${creator?`<span class="task-meta-item"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>by ${esc(creator)}</span>`:''} ${t.dueDate?`<span class="task-meta-item"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${fmtDate(t.dueDate)}</span>`:''}</div></div>`}).join('');
  list.querySelectorAll('.task-card').forEach(c=>c.addEventListener('click',()=>showTaskDetail(c.dataset.id)));
}
$$('[data-filter]').forEach(c=>c.addEventListener('click',()=>{$$('[data-filter]').forEach(x=>x.classList.remove('active'));c.classList.add('active');taskFilter=c.dataset.filter;renderTasks()}));

function showTaskDetail(tid,isEmp){
  const task=state.tasks.find(t=>t.id===tid);if(!task)return;
  const emp=state.employees.find(e=>e.id===task.assigneeId),sc=isOverdue(task)?'overdue':task.status;
  const body=$('#task-detail-body');
  const creator=task.createdBy==='owner'?state.ownerName:(state.employees.find(e=>e.id===task.createdBy)||{}).name||'Unknown';
  body.innerHTML=`<div class="task-detail-header"><div class="task-detail-title">${esc(task.title)}</div><span class="task-status-badge ${sc} task-detail-status">${sc}</span></div><div class="task-detail-info"><div class="task-detail-row"><span class="task-detail-label">Assigned To</span><span class="task-detail-value">${emp?esc(emp.name):'Unassigned'}</span></div><div class="task-detail-row"><span class="task-detail-label">Created By</span><span class="task-detail-value">${esc(creator)}</span></div><div class="task-detail-row"><span class="task-detail-label">Due Date</span><span class="task-detail-value">${task.dueDate?fmtDate(task.dueDate):'No due date'}</span></div><div class="task-detail-row"><span class="task-detail-label">Created On</span><span class="task-detail-value">${fmtDate(task.createdAt)}</span></div></div><div class="task-detail-actions">${task.status!=='done'?'<button class="btn btn-accent" data-act="done">Mark as Done</button>':'<button class="btn btn-outline" data-act="reopen">Reopen</button>'}${isEmp?'':'<button class="btn btn-danger-outline" data-act="delete">Delete</button>'}</div>`;
  body.querySelectorAll('[data-act]').forEach(btn=>btn.addEventListener('click',()=>{
    if(btn.dataset.act==='done'){task.status='done';toast('Task done!')}
    else if(btn.dataset.act==='reopen'){task.status='pending';toast('Task reopened')}
    else if(btn.dataset.act==='delete'){if(!confirm('Delete?'))return;state.tasks=state.tasks.filter(t=>t.id!==tid);toast('Task deleted')}
    save();closeSheet('sheet-task-detail');renderTasks();updateSummary();if(currentEmpId)renderEmpTasks();
  }));
  openSheet('sheet-task-detail');
}

function openAddTask(){updateDropdowns();$('#task-title').value='';$('#task-assignee').value='';$('#task-due').value=today();openSheet('sheet-task');setTimeout(()=>$('#task-title').focus(),300)}
$('#btn-add-first-task').addEventListener('click',openAddTask);$('#btn-add-task').addEventListener('click',openAddTask);$('#btn-cancel-task').addEventListener('click',()=>closeSheet('sheet-task'));
$('#form-task').addEventListener('submit',e=>{e.preventDefault();const title=$('#task-title').value.trim(),assignee=$('#task-assignee').value,due=$('#task-due').value;if(!title)return;state.tasks.push({id:id(),title,assigneeId:assignee,dueDate:due,status:'pending',createdAt:today(),createdBy:currentEmpId?currentEmpId:'owner'});save();closeSheet('sheet-task');renderTasks();updateSummary();renderDashboard();const emp=state.employees.find(e=>e.id===assignee);toast(emp?'Task assigned to '+emp.name:'Task created!')});

// ===== WAGES =====
function openWage(emp){$('#wage-emp-id').value=emp.id;$('#wage-emp-name').value=emp.name;const n=new Date();$('#wage-month').value=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0');$('#wage-amount').value=emp.wage||'';$$('.wage-status-btn').forEach(b=>b.classList.remove('active'));$('.wage-status-btn[data-status="paid"]').classList.add('active');openSheet('sheet-wage')}
$$('.wage-status-btn').forEach(b=>b.addEventListener('click',()=>{$$('.wage-status-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active')}));
$('#btn-cancel-wage').addEventListener('click',()=>closeSheet('sheet-wage'));
$('#form-wage').addEventListener('submit',e=>{e.preventDefault();const eid=$('#wage-emp-id').value,month=$('#wage-month').value,amount=$('#wage-amount').value,status=$('.wage-status-btn.active')?.dataset.status||'paid';if(!amount)return;const ex=state.wages.find(w=>w.empId===eid&&w.month===month);if(ex){ex.amount=amount;ex.status=status}else state.wages.push({id:id(),empId:eid,month,amount,status});save();closeSheet('sheet-wage');toast('Wage recorded')});

// ===== REPORTS =====
$$('.report-type-tab').forEach(t=>t.addEventListener('click',()=>{
  const container=t.closest('.bottom-sheet')||t.closest('.reports-container');
  if(!container)return;
  container.querySelectorAll('.report-type-tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');
  container.querySelectorAll('.report-panel').forEach(p=>p.classList.remove('active'));
  container.querySelector('#report-'+t.dataset.report)?.classList.add('active');
}));

function initReportDefaults(){const n=new Date(),f=new Date(n.getFullYear(),n.getMonth(),1);$('#att-report-from').value=localDateStr(f);$('#att-report-to').value=today();const m=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0');$('#wage-report-from').value=m;$('#wage-report-to').value=m}

$('#btn-download-att-report').addEventListener('click',()=>{
  const from=$('#att-report-from').value,to=$('#att-report-to').value,ef=$('#att-report-emp').value;
  if(!from||!to){toast('Select date range');return}
  const days=daysBetween(from,to),emps=ef==='all'?state.employees:state.employees.filter(e=>e.id===ef);
  if(!emps.length){toast('No employees');return}
  let csv='Employee,Role,Phone,'+days.join(',')+',Total Present,Total Absent,Total Half Day\n';
  emps.forEach(emp=>{let p=0,a=0,h=0;const st=days.map(d=>{const s=(state.attendance[d]||{})[emp.id]||'';if(s==='P')p++;else if(s==='A')a++;else if(s==='H')h++;return s||'-'});csv+=`"${emp.name}","${emp.role||''}","${emp.phone||''}",${st.join(',')},${p},${a},${h}\n`});
  downloadCSV('attendance-'+from+'-to-'+to+'.csv',csv);toast('Report downloaded');
});
$('#btn-download-wage-report').addEventListener('click',()=>{
  const from=$('#wage-report-from').value,to=$('#wage-report-to').value;if(!from||!to){toast('Select month range');return}
  const wf=state.wages.filter(w=>w.month>=from&&w.month<=to).sort((a,b)=>a.month.localeCompare(b.month));
  if(!wf.length){toast('No wage records');return}
  let csv='Employee,Role,Phone,Month,Amount (₹),Status\n';
  wf.forEach(w=>{const emp=state.employees.find(e=>e.id===w.empId);csv+=`"${emp?emp.name:'Unknown'}","${emp?emp.role||'':''}","${emp?emp.phone||'':''}","${w.month}",${w.amount},"${w.status}"\n`});
  downloadCSV('wages-'+from+'-to-'+to+'.csv',csv);toast('Report downloaded');
});
$('#btn-download-emp-report').addEventListener('click',()=>{
  if(!state.employees.length){toast('No employees');return}
  let csv='Name,Role,Phone,Joining Date,Govt ID,Monthly Wage (₹),Status\n';
  state.employees.forEach(e=>csv+=`"${e.name}","${e.role||''}","${e.phone||''}","${e.joiningDate||''}","${e.govtId||''}","${e.wage||''}","${e.status||'active'}"\n`);
  downloadCSV('employees-'+today()+'.csv',csv);toast('Report downloaded');
});
$('#btn-download-leave-report').addEventListener('click',()=>{
  const ef=$('#leave-report-emp').value;let lv=ef==='all'?state.leaves:state.leaves.filter(l=>l.empId===ef);
  if(!lv.length){toast('No leave records');return}
  let csv='Employee,Role,Leave Type,From Date,To Date,Days,Reason,Status,Requested On\n';
  lv.forEach(l=>{const emp=state.employees.find(e=>e.id===l.empId),days=daysBetween(l.fromDate,l.toDate).length;csv+=`"${emp?emp.name:'Unknown'}","${emp?emp.role||'':''}","${l.type}","${l.fromDate}","${l.toDate}",${days},"${l.reason||''}","${l.status}","${l.createdAt}"\n`});
  downloadCSV('leaves-'+today()+'.csv',csv);toast('Report downloaded');
});

function updateSummary(){
  const ae=activeEmps();
  $('#summary-employees').textContent=ae.length;
  const td=state.attendance[today()]||{};
  const presentCount=ae.filter(e=>td[e.id]==='P'||td[e.id]==='H').length;
  $('#summary-present').textContent=presentCount;
  $('#summary-tasks-pending').textContent=state.tasks.filter(t=>t.status==='pending').length;
  $('#summary-tasks-overdue').textContent=state.tasks.filter(t=>isOverdue(t)).length;
  renderDashboard();
}

// Helper: switch to a named tab (handles tabs not in nav, e.g. employees)
function switchTab(tabId){
  $$('#screen-main .tab-panel').forEach(p=>p.classList.remove('active'));
  const panel=$('#tab-'+tabId);if(panel)panel.classList.add('active');
  $$('.nav-item[data-tab]').forEach(x=>x.classList.remove('active'));
  const navItem=document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if(navItem)navItem.classList.add('active');
}
// Dashboard card clicks
$('#dash-card-employees').addEventListener('click',()=>switchTab('employees'));
$('#dash-card-present').addEventListener('click',()=>switchTab('attendance'));
$('#dash-card-pending').addEventListener('click',()=>{taskFilter='pending';$$('[data-filter]').forEach(x=>x.classList.remove('active'));$$('[data-filter="pending"]').forEach(x=>x.classList.add('active'));renderTasks();switchTab('tasks')});
$('#dash-card-overdue').addEventListener('click',()=>{taskFilter='overdue';$$('[data-filter]').forEach(x=>x.classList.remove('active'));$$('[data-filter="overdue"]').forEach(x=>x.classList.add('active'));renderTasks();switchTab('tasks')});

function renderDashboard(){
  const ae=activeEmps();
  // Upcoming tasks (pending/overdue, sorted by due date, max 5)
  const upcoming=[...state.tasks].filter(t=>t.status==='pending').map(t=>({...t,isOD:isOverdue(t)})).sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999')).slice(0,5);
  const tasksEl=$('#dash-upcoming-tasks');
  if(!upcoming.length){tasksEl.innerHTML='<p class="dash-empty">No pending tasks</p>'}
  else{tasksEl.innerHTML=upcoming.map(t=>{const emp=state.employees.find(e=>e.id===t.assigneeId);return`<div class="dash-mini-card" data-task-id="${t.id}"><div class="dash-mini-left"><div class="dash-mini-title">${esc(t.title)}</div><div class="dash-mini-sub">${emp?esc(emp.name):'Unassigned'}${t.dueDate?' · Due '+fmtDate(t.dueDate):''}</div></div><span class="task-status-badge ${t.isOD?'overdue':'pending'}">${t.isOD?'overdue':'pending'}</span></div>`}).join('');
  tasksEl.querySelectorAll('.dash-mini-card').forEach(c=>c.addEventListener('click',()=>showTaskDetail(c.dataset.taskId)))}

  // Recent leaves (last 5)
  const recentLeaves=[...state.leaves].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5);
  const leavesEl=$('#dash-recent-leaves');
  if(!recentLeaves.length){leavesEl.innerHTML='<p class="dash-empty">No leave requests</p>'}
  else{leavesEl.innerHTML=recentLeaves.map(l=>{const emp=state.employees.find(e=>e.id===l.empId);return`<div class="dash-mini-card" data-leave-id="${l.id}"><div class="dash-mini-left"><div class="dash-mini-title">${emp?esc(emp.name):'Unknown'} · ${l.type} leave</div><div class="dash-mini-sub">${fmtDate(l.fromDate)} — ${fmtDate(l.toDate)}</div></div><span class="task-status-badge ${l.status}">${l.status}</span></div>`}).join('');
  leavesEl.querySelectorAll('.dash-mini-card').forEach(c=>c.addEventListener('click',()=>showLeaveDetail(c.dataset.leaveId)))}

  // Wage summary this month
  const curMonth=new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0');
  const monthWages=state.wages.filter(w=>w.month===curMonth);
  const totalWage=ae.reduce((s,e)=>s+Number(e.wage||0),0);
  const paidWage=monthWages.filter(w=>w.status==='paid').reduce((s,w)=>s+Number(w.amount||0),0);
  const unpaidWage=totalWage-paidWage;
  const wageEl=$('#dash-wage-summary');
  wageEl.innerHTML=`<div class="dash-wage-row"><span class="dash-wage-label">Total Payroll</span><span class="dash-wage-value">₹${totalWage.toLocaleString('en-IN')}</span></div><div class="dash-wage-row"><span class="dash-wage-label">Paid</span><span class="dash-wage-value" style="color:var(--accent)">₹${paidWage.toLocaleString('en-IN')}</span></div><div class="dash-wage-row"><span class="dash-wage-label">Unpaid</span><span class="dash-wage-value" style="color:${unpaidWage>0?'var(--danger)':'var(--text)'}">₹${unpaidWage.toLocaleString('en-IN')}</span></div>`;
}

// ===== HAMBURGER MENU =====
function openHamburger(){
  $('#hamburger-biz-name').textContent=state.businessName;
  $('#hamburger-owner-name').textContent=state.ownerName;
  $('#hamburger-menu').classList.add('open');
}
function closeHamburger(){$('#hamburger-menu').classList.remove('open')}
$('#btn-hamburger').addEventListener('click',openHamburger);
$('#hamburger-overlay').addEventListener('click',closeHamburger);
$('#hmenu-employees').addEventListener('click',()=>{closeHamburger();switchTab('employees')});
$('#hmenu-download-reports').addEventListener('click',()=>{closeHamburger();initReportDefaults();updateDropdowns();openSheet('sheet-download-reports')});
$('#hmenu-offer-letter').addEventListener('click',()=>{closeHamburger();openOfferLetterGen()});
$('#hmenu-permissions').addEventListener('click',()=>{closeHamburger();openPermissionsSheet()});
$('#hmenu-settings').addEventListener('click',()=>{closeHamburger();openSettings()});
$('#hmenu-export').addEventListener('click',()=>{closeHamburger();const b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='workmitra-backup-'+today()+'.json';a.click();URL.revokeObjectURL(u);toast('Data exported')});
$('#hmenu-logout').addEventListener('click',()=>{closeHamburger();clearSession();showScreen('screen-role-select');toast('Logged out')});


// ===== SETTINGS =====
function openSettings(){
  $('#settings-business').value=state.businessName;$('#settings-owner').value=state.ownerName;$('#settings-biz-type').value=state.businessType||'';$('#settings-phone').value=state.phone;$('#settings-email').value=state.email||'';$('#settings-address').value=state.address||'';$('#settings-city').value=state.city||'';$('#settings-state').value=state.bizState||'';$('#settings-pincode').value=state.pincode||'';$('#settings-gst').value=state.gst||'';
  openSheet('sheet-settings');
}
$('#btn-save-settings').addEventListener('click',()=>{state.businessName=$('#settings-business').value.trim()||state.businessName;state.ownerName=$('#settings-owner').value.trim()||state.ownerName;state.businessType=$('#settings-biz-type').value;state.phone=$('#settings-phone').value.trim();state.email=$('#settings-email').value.trim();state.address=$('#settings-address').value.trim();state.city=$('#settings-city').value.trim();state.bizState=$('#settings-state').value.trim();state.pincode=$('#settings-pincode').value.trim();state.gst=$('#settings-gst').value.trim();save();$('#header-business-name').textContent=state.businessName;closeSheet('sheet-settings');toast('Profile saved')});
$('#btn-clear-data').addEventListener('click',()=>{if(confirm('This will delete ALL data including employees, attendance, tasks and wages. Export a backup first if needed. Continue?')){localStorage.removeItem(DB);clearSession();state=defaults();closeSheet('sheet-settings');showScreen('screen-role-select');toast('All data cleared')}});

// ===== PERMISSIONS =====
function openPermissionsSheet(){
  const active=activeEmps();
  const permDefs=[
    {key:'leaveApproval',label:'Leave Approval & Attendance',desc:'Can mark attendance for all employees and approve/reject leave requests.',enables:'Mark daily attendance, approve/reject leaves, revoke approved leaves, delete leave requests'},
    {key:'salaryPayout',label:'Salary Payout',desc:'Can manage monthly salary payouts for all employees.',enables:'View & confirm monthly salary payout, mark salaries as paid'},
    {key:'reports',label:'Download Reports',desc:'Can access and download business reports.',enables:'Download attendance, wage, employee, and leave reports as CSV'}
  ];
  const list=$('#permissions-list');
  list.innerHTML=permDefs.map(p=>{
    const current=state.permissions[p.key]||[];
    // Ensure owner is always in the permission array
    if(!current.includes('owner'))current.push('owner');
    return`<div class="perm-card"><div class="perm-card-header"><div class="perm-card-title">${p.label}</div></div><div class="perm-card-desc">${p.desc}</div><div class="perm-enables"><strong>This enables:</strong> ${p.enables}</div><div class="perm-checkboxes" data-perm="${p.key}"><label class="perm-check-item" style="opacity:0.6"><input type="checkbox" value="owner" checked disabled><span class="perm-check-name">${esc(state.ownerName)} <span class="access-role-badge" style="font-size:10px">Owner</span></span></label>${active.map(e=>`<label class="perm-check-item"><input type="checkbox" value="${e.id}" ${current.includes(e.id)?'checked':''}><span class="perm-check-name">${esc(e.name)}${e.role?' — '+esc(e.role):''}</span></label>`).join('')}</div></div>`
  }).join('');
  list.querySelectorAll('.perm-checkboxes').forEach(wrap=>{
    wrap.querySelectorAll('input[type="checkbox"]').forEach(cb=>cb.addEventListener('change',()=>{
      const key=wrap.dataset.perm;
      const checked=Array.from(wrap.querySelectorAll('input:checked:not(:disabled)')).map(c=>c.value);
      if(!checked.includes('owner'))checked.unshift('owner');
      state.permissions[key]=checked;
      save();toast('Permission updated');
    }));
  });
  openSheet('sheet-permissions');
}

// ===== OFFER LETTER GENERATOR =====
function openOfferLetterGen(){
  $('#offergen-name').value='';$('#offergen-role').value='';$('#offergen-joining').value='';$('#offergen-salary').value='';$('#offergen-location').value=state.city||'';$('#offergen-terms').value='';
  $('#offer-gen-form').style.display='';$('#offer-gen-preview').style.display='none';
  openSheet('sheet-offer-letter-gen');
}
function buildOfferLetterText(){
  const name=$('#offergen-name').value.trim();
  const role=$('#offergen-role').value.trim();
  const joining=$('#offergen-joining').value;
  const salary=$('#offergen-salary').value;
  const location=$('#offergen-location').value.trim();
  const terms=$('#offergen-terms').value.trim();
  return{name,role,joining,salary,location,terms};
}
$('#btn-offergen-preview').addEventListener('click',()=>{
  const f=buildOfferLetterText();
  if(!f.name||!f.role){toast('Name and role are required');return}
  const joiningStr=f.joining?fmtDate(f.joining):'[To be confirmed]';
  const salStr=f.salary?'₹'+Number(f.salary).toLocaleString('en-IN')+' per month':'[To be discussed]';
  const preview=$('#offer-preview-content');
  preview.innerHTML=`
    <h4>${esc(state.businessName)}</h4>
    <div class="offer-date">Date: ${fmtDate(today())}</div>
    <div class="offer-para">Dear <span class="offer-field">${esc(f.name)}</span>,</div>
    <div class="offer-para">We are pleased to offer you the position of <span class="offer-field">${esc(f.role)}</span> at <span class="offer-field">${esc(state.businessName)}</span>.</div>
    <table class="offer-table">
      <tr><td>Position</td><td>${esc(f.role)}</td></tr>
      <tr><td>Joining Date</td><td>${joiningStr}</td></tr>
      <tr><td>Monthly Salary</td><td>${salStr}</td></tr>
      ${f.location?`<tr><td>Work Location</td><td>${esc(f.location)}</td></tr>`:''}
    </table>
    ${f.terms?`<div class="offer-para"><strong>Terms & Conditions:</strong><br>${esc(f.terms)}</div>`:''}
    <div class="offer-sign">
      Regards,<br>
      <strong>${esc(state.ownerName)}</strong><br>
      ${esc(state.businessName)}${f.location?'<br>'+esc(f.location):''}
    </div>`;
  $('#offer-gen-form').style.display='none';$('#offer-gen-preview').style.display='';
});
$('#btn-offergen-back').addEventListener('click',()=>{$('#offer-gen-form').style.display='';$('#offer-gen-preview').style.display='none'});
$('#btn-offergen-cancel').addEventListener('click',()=>closeSheet('sheet-offer-letter-gen'));
$('#btn-offergen-pdf').addEventListener('click',()=>toast('PDF download coming soon'));
$('#btn-offergen-share').addEventListener('click',()=>toast('Share feature coming soon'));

// ===== EMPLOYEE APP =====
let currentEmpId=null;

function initEmployeeApp(emp){
  currentEmpId=emp.id;
  $('#emp-header-name').textContent=emp.name;
  // Set up employee hamburger menu visibility based on permissions
  const isHR=hasPerm('leaveApproval',emp.id);
  const isAccountant=hasPerm('salaryPayout',emp.id)||hasPerm('reports',emp.id);
  const hasAnyPerm=isHR||isAccountant;
  const canPayout=hasPerm('salaryPayout',emp.id);
  $('#ehmenu-mark-attendance').style.display=isHR?'':'none';
  $('#ehmenu-approve-leaves').style.display=isHR?'':'none';
  $('#ehmenu-salary-payout').style.display=canPayout?'':'none';
  $('#ehmenu-wage-records').style.display=isAccountant?'':'none';
  $('#ehmenu-perm-divider').style.display=(hasAnyPerm||canPayout)?'':'none';
  $('#emp-hamburger-name').textContent=emp.name;
  $('#emp-hamburger-role').textContent=emp.role||'Employee';
  renderEmpTasks();renderEmpAttendance();renderEmpLeaves();renderEmpPayouts();
  if(isHR)renderHrAttendance();
  if(isAccountant)renderAccountantWages();
}

// Emp tab nav
$$('[data-emp-tab]').forEach(b=>b.addEventListener('click',()=>{
  b.closest('.bottom-nav').querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));b.classList.add('active');
  $$('#screen-emp-main .tab-panel').forEach(p=>p.classList.remove('active'));$('#'+b.dataset.empTab).classList.add('active');
}));

// Emp task filters
let empTaskFilter='all';
$$('[data-emp-task-filter]').forEach(c=>c.addEventListener('click',()=>{$$('[data-emp-task-filter]').forEach(x=>x.classList.remove('active'));c.classList.add('active');empTaskFilter=c.dataset.empTaskFilter;renderEmpTasks()}));

function renderEmpTasks(){
  let tasks=state.tasks.filter(t=>t.assigneeId===currentEmpId);
  tasks.forEach(t=>{t.displayStatus=t.status==='pending'&&t.dueDate&&t.dueDate<today()?'overdue':t.status});
  if(!tasks.length){$('#emp-tasks-empty').style.display='';$('#emp-tasks-list-container').style.display='none';return}
  $('#emp-tasks-empty').style.display='none';$('#emp-tasks-list-container').style.display='';
  let f=tasks;if(empTaskFilter==='pending')f=tasks.filter(t=>t.displayStatus==='pending');else if(empTaskFilter==='done')f=tasks.filter(t=>t.status==='done');else if(empTaskFilter==='overdue')f=tasks.filter(t=>t.displayStatus==='overdue');
  f.sort((a,b)=>{const o={overdue:0,pending:1,done:2};return(o[a.displayStatus]||1)-(o[b.displayStatus]||1)||(a.dueDate||'9999').localeCompare(b.dueDate||'9999')});
  const list=$('#emp-tasks-list');
  list.innerHTML=f.map(t=>{const sc=t.displayStatus;return`<div class="task-card ${sc}" data-id="${t.id}"><div class="task-title-row"><span class="task-title">${esc(t.title)}</span><span class="task-status-badge ${sc}">${sc}</span></div><div class="task-meta">${t.dueDate?`<span class="task-meta-item"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/></svg>${fmtDate(t.dueDate)}</span>`:''}</div></div>`}).join('');
  list.querySelectorAll('.task-card').forEach(c=>c.addEventListener('click',()=>showTaskDetail(c.dataset.id,true)));
}

let empAttFilter='all';
function renderEmpAttendance(){
  const body=$('#emp-att-summary'),hist=$('#emp-att-history');
  const monthInput=$('#emp-att-month');
  // Default month picker to current month if empty
  if(!monthInput.value){const n=new Date();monthInput.value=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')}
  const parts=monthInput.value.split('-');const yr=parseInt(parts[0]),mo=parseInt(parts[1]);
  const daysInMonth=new Date(yr,mo,0).getDate();
  const days=[];
  for(let i=daysInMonth;i>=1;i--){const d=new Date(yr,mo-1,i);const ds=localDateStr(d);if(ds<=today())days.push({date:d,ds})}
  let p=0,a=0,h=0;
  days.forEach(d=>{const s=(state.attendance[d.ds]||{})[currentEmpId];if(s==='P')p++;else if(s==='A')a++;else if(s==='H')h++});
  body.innerHTML=`<div class="emp-att-stat"><span class="stat-num stat-present">${p}</span><span class="stat-label">Present</span></div><div class="emp-att-stat"><span class="stat-num stat-absent">${a}</span><span class="stat-label">Absent</span></div><div class="emp-att-stat"><span class="stat-num stat-half">${h}</span><span class="stat-label">Half Day</span></div>`;
  let filtered=days;
  if(empAttFilter!=='all')filtered=days.filter(d=>(state.attendance[d.ds]||{})[currentEmpId]===empAttFilter);
  hist.innerHTML=`<div style="padding:0 16px 16px">${filtered.map(d=>{const s=(state.attendance[d.ds]||{})[currentEmpId];return`<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light)"><span style="font-size:14px;color:var(--text-secondary)">${d.date.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</span><span class="att-history-cell ${s==='P'?'present':s==='A'?'absent':s==='H'?'half':''}">${s==='P'?'Present':s==='A'?'Absent':s==='H'?'Half Day':'—'}</span></div>`}).join('')}${!filtered.length?'<p class="dash-empty">No records for this filter</p>':''}</div>`;
}
$('#emp-att-month').addEventListener('change',()=>renderEmpAttendance());
$$('[data-emp-att-filter]').forEach(c=>c.addEventListener('click',()=>{$$('[data-emp-att-filter]').forEach(x=>x.classList.remove('active'));c.classList.add('active');empAttFilter=c.dataset.empAttFilter;renderEmpAttendance()}));

function renderEmpLeaves(){
  const leaves=state.leaves.filter(l=>l.empId===currentEmpId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  if(!leaves.length){$('#emp-leaves-empty').style.display='';$('#emp-leaves-list').innerHTML='';return}
  $('#emp-leaves-empty').style.display='none';
  $('#emp-leaves-list').innerHTML=leaves.map(l=>`<div class="leave-card ${l.status}" data-id="${l.id}"><div class="leave-card-header"><div><span class="leave-type-badge">${l.type} leave</span></div><span class="task-status-badge ${l.status}">${l.status}</span></div><div class="leave-card-meta"><span>${fmtDate(l.fromDate)} — ${fmtDate(l.toDate)}</span>${l.reason?`<span>${esc(l.reason)}</span>`:''}</div></div>`).join('');
  // Employees can only VIEW their leaves, no approve/reject
  $('#emp-leaves-list').querySelectorAll('.leave-card').forEach(c=>c.addEventListener('click',()=>{
    const hasLeavePermission=hasPerm('leaveApproval',currentEmpId);
    if(hasLeavePermission){
      showLeaveDetail(c.dataset.id);
    } else {
      // Show read-only view
      showLeaveDetailReadOnly(c.dataset.id);
    }
  }));
}

function showLeaveDetailReadOnly(lid){
  const leave=state.leaves.find(l=>l.id===lid);if(!leave)return;
  const emp=state.employees.find(e=>e.id===leave.empId),days=daysBetween(leave.fromDate,leave.toDate).length;
  const body=$('#leave-detail-body');
  body.innerHTML=`<h3 class="sheet-title">Leave Request</h3><div class="task-detail-info" style="border-top:none;padding-top:0"><div class="task-detail-row"><span class="task-detail-label">Type</span><span class="task-detail-value" style="text-transform:capitalize">${leave.type} Leave</span></div><div class="task-detail-row"><span class="task-detail-label">From</span><span class="task-detail-value">${fmtDate(leave.fromDate)}</span></div><div class="task-detail-row"><span class="task-detail-label">To</span><span class="task-detail-value">${fmtDate(leave.toDate)}</span></div><div class="task-detail-row"><span class="task-detail-label">Duration</span><span class="task-detail-value">${days} day${days!==1?'s':''}</span></div>${leave.reason?`<div class="task-detail-row"><span class="task-detail-label">Reason</span><span class="task-detail-value">${esc(leave.reason)}</span></div>`:''}<div class="task-detail-row"><span class="task-detail-label">Status</span><span class="task-status-badge ${leave.status}">${leave.status}</span></div></div>`;
  openSheet('sheet-leave-detail');
}

function renderEmpPayouts(){
  const wages=state.wages.filter(w=>w.empId===currentEmpId).sort((a,b)=>b.month.localeCompare(a.month));
  if(!wages.length){$('#emp-payouts-empty').style.display='';$('#emp-payouts-list').innerHTML='';return}
  $('#emp-payouts-empty').style.display='none';
  $('#emp-payouts-list').innerHTML=wages.map(w=>`<div class="emp-payout-card"><div><div class="emp-payout-month">${w.month}</div></div><div style="text-align:right"><div class="emp-payout-amount">₹${Number(w.amount).toLocaleString('en-IN')}</div><span class="task-status-badge ${w.status==='paid'?'done':'overdue'}" style="margin-top:4px">${w.status}</span></div></div>`).join('');
}

$('#btn-emp-request-leave').addEventListener('click',()=>openLeaveSheet(currentEmpId,true));

// ===== EMPLOYEE HAMBURGER MENU =====
function openEmpHamburger(){$('#emp-hamburger-menu').classList.add('open')}
function closeEmpHamburger(){$('#emp-hamburger-menu').classList.remove('open')}
$('#btn-emp-hamburger').addEventListener('click',openEmpHamburger);
$('#emp-hamburger-overlay').addEventListener('click',closeEmpHamburger);
$('#ehmenu-mark-attendance').addEventListener('click',()=>{closeEmpHamburger();$$('#screen-emp-main .tab-panel').forEach(p=>p.classList.remove('active'));$('#etab-hr-attendance').classList.add('active');$('#emp-bottom-nav').querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'))});
$('#ehmenu-approve-leaves').addEventListener('click',()=>{closeEmpHamburger();$$('#screen-emp-main .tab-panel').forEach(p=>p.classList.remove('active'));$('#etab-leaves').classList.add('active');$('#emp-bottom-nav').querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));$('#emp-bottom-nav [data-emp-tab="etab-leaves"]').classList.add('active')});
$('#ehmenu-salary-payout').addEventListener('click',()=>{closeEmpHamburger();openSalaryPayout()});
$('#ehmenu-wage-records').addEventListener('click',()=>{closeEmpHamburger();$$('#screen-emp-main .tab-panel').forEach(p=>p.classList.remove('active'));$('#etab-wages').classList.add('active');$('#emp-bottom-nav').querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'))});
$('#ehmenu-profile').addEventListener('click',()=>{
  closeEmpHamburger();
  const emp=state.employees.find(e=>e.id===currentEmpId);if(!emp)return;
  const permLabels=[];
  if(hasPerm('leaveApproval',emp.id))permLabels.push('Leave Approval & Attendance');
  if(hasPerm('salaryPayout',emp.id))permLabels.push('Salary Payout');
  if(hasPerm('reports',emp.id))permLabels.push('Reports');
  const body=$('#emp-profile-body');
  body.innerHTML=`<div class="emp-detail-header"><div class="emp-detail-avatar ${avatarCls(emp.id)}">${ini(emp.name)}</div><div class="emp-detail-name">${esc(emp.name)}</div><div class="emp-detail-role">${esc(emp.role||'No role')}</div>${permLabels.length?`<div style="margin-top:8px">${permLabels.map(l=>`<span class="access-role-badge" style="margin:2px">${l}</span>`).join('')}</div>`:''}</div><div class="detail-grid"><div class="detail-item"><div class="detail-item-label">Phone</div><div class="detail-item-value">${emp.phone?'+91 '+emp.phone:'—'}</div></div><div class="detail-item"><div class="detail-item-label">Joining Date</div><div class="detail-item-value">${emp.joiningDate?fmtDate(emp.joiningDate):'—'}</div></div></div>`;
  openSheet('sheet-emp-profile');
});
$('#ehmenu-logout').addEventListener('click',()=>{closeEmpHamburger();currentEmpId=null;clearSession();showScreen('screen-role-select');toast('Logged out')});

// ===== EMPLOYEE EXIT =====
function openExitSheet(emp){
  $('#exit-emp-id').value=emp.id;$('#exit-date').value=today();$('#exit-reason').value='Resigned';openSheet('sheet-emp-exit');
}
$('#btn-cancel-exit').addEventListener('click',()=>closeSheet('sheet-emp-exit'));
$('#form-emp-exit').addEventListener('submit',e=>{
  e.preventDefault();const eid=$('#exit-emp-id').value,emp=state.employees.find(x=>x.id===eid);if(!emp)return;
  emp.status='exited';emp.exitDate=$('#exit-date').value;emp.exitReason=$('#exit-reason').value;
  // Clean up permissions for exited employee
  Object.keys(state.permissions).forEach(k=>{if(Array.isArray(state.permissions[k]))state.permissions[k]=state.permissions[k].filter(id=>id!==eid)});
  save();closeSheet('sheet-emp-exit');renderEmployees();renderAttendance();updateDropdowns();updateSummary();toast(emp.name+' marked as exited');
});

// ===== OFFER LETTER =====
function showOfferLetter(emp){
  const body=$('#offer-letter-body');
  if(emp.doc_offer){
    body.innerHTML=`
      <div class="offer-attached-card">
        <div class="offer-attached-icon"><svg width="28" height="28" fill="none" stroke="var(--accent)" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/></svg></div>
        <div><div style="font-weight:700;font-size:16px">Offer Letter</div><div style="font-size:13px;color:var(--text-secondary);margin-top:2px">Document attached</div></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <a href="${emp.doc_offer}" target="_blank" class="btn btn-primary" style="flex:1;text-align:center">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> View
        </a>
        <label class="btn btn-ghost" style="flex:1;text-align:center;cursor:pointer">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Replace
          <input type="file" id="offer-letter-file-input" accept="image/*,application/pdf" style="display:none">
        </label>
      </div>
      <div style="text-align:center;margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">Need to generate a new one?</p>
        <button class="btn btn-outline" id="btn-offer-goto-gen" style="font-size:14px">Generate Offer Letter →</button>
      </div>`;
  } else {
    body.innerHTML=`
      <p style="font-size:14px;color:var(--text-secondary);margin-bottom:16px">Attach the offer letter shared with <strong>${esc(emp.name)}</strong> before they joined.</p>
      <label class="doc-upload-card" id="offer-upload-card" style="width:100%;max-width:none;padding:24px 16px">
        <input type="file" id="offer-letter-file-input" accept="image/*,application/pdf" style="display:none">
        <div class="doc-upload-icon"><svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg></div>
        <div class="doc-upload-name">Upload Offer Letter</div>
        <div class="doc-upload-status" id="offer-upload-status">Tap to select file (PDF or image)</div>
      </label>
      <button class="btn btn-primary btn-full" id="btn-offer-save" style="margin-top:12px" disabled>Save Offer Letter</button>
      <div style="text-align:center;margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">Don't have one yet?</p>
        <button class="btn btn-outline" id="btn-offer-goto-gen" style="font-size:14px">Generate Offer Letter →</button>
      </div>`;
  }
  // File input handler
  const fileInput=body.querySelector('#offer-letter-file-input');
  if(fileInput){
    fileInput.addEventListener('change',function(){
      if(!this.files[0])return;
      const reader=new FileReader();
      reader.onload=ev=>{
        fileInput.dataset.dataUrl=ev.target.result;
        const card=body.querySelector('#offer-upload-card');
        const status=body.querySelector('#offer-upload-status');
        const saveBtn=body.querySelector('#btn-offer-save');
        if(card)card.classList.add('has-file');
        if(status)status.textContent='✓ '+this.files[0].name.slice(0,24)+(this.files[0].name.length>24?'…':'');
        if(saveBtn)saveBtn.disabled=false;
        // Replace flow: auto-save immediately
        if(emp.doc_offer&&fileInput.dataset.dataUrl){
          emp.doc_offer=fileInput.dataset.dataUrl;save();closeSheet('sheet-offer-letter');showEmpDetail(emp.id);toast('Offer letter replaced');
        }
      };
      reader.readAsDataURL(this.files[0]);
    });
  }
  // Save button
  const saveBtn=body.querySelector('#btn-offer-save');
  if(saveBtn){
    saveBtn.addEventListener('click',()=>{
      if(fileInput&&fileInput.dataset.dataUrl){
        emp.doc_offer=fileInput.dataset.dataUrl;save();closeSheet('sheet-offer-letter');showEmpDetail(emp.id);toast('Offer letter saved!');
      }
    });
  }
  // Go to generator
  const genBtn=body.querySelector('#btn-offer-goto-gen');
  if(genBtn)genBtn.addEventListener('click',()=>{closeSheet('sheet-offer-letter');openOfferLetterGen()});
  openSheet('sheet-offer-letter');
}

// ===== RELIEVING LETTER =====
function showRelievingLetter(emp){
  const body=$('#relieving-letter-body');
  body.innerHTML=`<div class="letter-preview"><h4>RELIEVING LETTER</h4><p>Date: ${fmtDate(today())}</p><p>To Whom It May Concern,</p><p>This is to certify that <span class="field">${esc(emp.name)}</span> was employed with <span class="field">${esc(state.businessName)}</span> as <span class="field">${esc(emp.role||'Employee')}</span> from <span class="field">${emp.joiningDate?fmtDate(emp.joiningDate):'[N/A]'}</span> to <span class="field">${emp.exitDate?fmtDate(emp.exitDate):'[N/A]'}</span>.</p><p>Reason for leaving: <span class="field">${emp.exitReason?esc(emp.exitReason):'[N/A]'}</span></p><p>We wish them all the best in their future endeavors.</p><p style="margin-top:16px">Regards,<br><span class="field">${esc(state.ownerName)}</span><br>${esc(state.businessName)}</p></div><button class="btn btn-primary btn-full" disabled>Generate Relieving Letter (Coming Soon)</button><p class="letter-coming-soon">Auto-generated relieving letters - coming in v2</p>`;
  openSheet('sheet-relieving-letter');
}

// ===== SALARY PAYOUT =====
let payoutMonth='';
function openSalaryPayout(){
  const n=new Date();payoutMonth=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0');
  $('#payout-month').value=payoutMonth;renderPayoutList();openSheet('sheet-salary-payout');
}
function renderPayoutList(){
  const active=activeEmps();const list=$('#payout-list');
  if(!active.length){list.innerHTML='<p style="text-align:center;color:var(--text-secondary);padding:24px">No active employees</p>';return}
  list.innerHTML=active.map(emp=>{
    const existing=state.wages.find(w=>w.empId===emp.id&&w.month===payoutMonth);
    const isPaid=existing&&existing.status==='paid';
    return`<div class="payout-row"><label><input type="checkbox" data-emp-id="${emp.id}" ${isPaid?'':'checked'}${isPaid?' disabled':''}><span>${esc(emp.name)}</span></label><div class="payout-info">${esc(emp.role||'')}<br><strong>₹${emp.wage?Number(emp.wage).toLocaleString('en-IN'):'0'}</strong>${isPaid?'<br><span style="color:var(--accent);font-size:11px;font-weight:700">PAID</span>':''}</div></div>`
  }).join('');
  const totalWage=active.filter(e=>{const ex=state.wages.find(w=>w.empId===e.id&&w.month===payoutMonth);return!(ex&&ex.status==='paid')}).reduce((s,e)=>s+Number(e.wage||0),0);
  list.innerHTML+=`<div class="payout-total">Unpaid Total: ₹${totalWage.toLocaleString('en-IN')}</div>`;
}
$('#payout-month').addEventListener('change',e=>{payoutMonth=e.target.value;renderPayoutList()});
$('#btn-cancel-payout').addEventListener('click',()=>closeSheet('sheet-salary-payout'));
$('#btn-confirm-payout').addEventListener('click',()=>{
  const checks=$$('#payout-list input[type="checkbox"]:checked:not(:disabled)');
  if(!checks.length){toast('No employees to pay');return}
  let total=0;const names=[];
  checks.forEach(cb=>{const emp=state.employees.find(e=>e.id===cb.dataset.empId);if(emp){total+=Number(emp.wage||0);names.push(emp.name)}});
  if(!confirm('Pay ₹'+total.toLocaleString('en-IN')+' to '+checks.length+' employee(s) for '+payoutMonth+'?'))return;
  checks.forEach(cb=>{
    const empId=cb.dataset.empId,emp=state.employees.find(e=>e.id===empId);if(!emp)return;
    const ex=state.wages.find(w=>w.empId===empId&&w.month===payoutMonth);
    if(ex){ex.amount=emp.wage||0;ex.status='paid'}
    else state.wages.push({id:id(),empId,month:payoutMonth,amount:emp.wage||0,status:'paid'});
  });
  save();closeSheet('sheet-salary-payout');toast('Salary marked as paid for '+checks.length+' employee(s)');
});
$('#hmenu-salary-payout').addEventListener('click',()=>{closeHamburger();openSalaryPayout()});

// ===== HR ATTENDANCE (Employee with HR role) =====
let hrAttDate=today();
function renderHrAttendance(){
  const active=activeEmps();
  const d=new Date(hrAttDate+'T00:00:00'),td=today();
  if(hrAttDate===td)$('#hr-att-date-display').textContent='Today';
  else{const y=new Date();y.setDate(y.getDate()-1);$('#hr-att-date-display').textContent=hrAttDate===localDateStr(y)?'Yesterday':d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}
  $('#hr-att-date-sub').textContent=d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
  $('#hr-att-next-day').disabled=hrAttDate>=td;$('#hr-att-date-picker').value=hrAttDate;
  const dd=state.attendance[hrAttDate]||{},total=active.length,marked=active.filter(e=>dd[e.id]).length;
  const pct=total?Math.round(marked/total*100):0;$('#hr-att-progress-fill').style.width=pct+'%';$('#hr-att-progress-text').textContent=marked+' of '+total+' marked';
  const appLeaves={};state.leaves.filter(l=>l.status==='approved').forEach(l=>{if(daysBetween(l.fromDate,l.toDate).includes(hrAttDate))appLeaves[l.empId]=l.type});
  const list=$('#hr-attendance-list');
  list.innerHTML=active.map(emp=>{const s=dd[emp.id]||'',ol=appLeaves[emp.id];return`<div class="att-row" data-id="${emp.id}"><div class="emp-avatar ${avatarCls(emp.id)}" style="width:36px;height:36px;font-size:13px">${ini(emp.name)}</div><div style="flex:1;min-width:0"><span class="att-name">${esc(emp.name)}</span>${ol?`<span class="att-leave-tag">${ol} leave</span>`:''}</div><div class="att-buttons"><button class="att-btn ${s==='P'?'present':''}" data-s="P">P</button><button class="att-btn ${s==='A'?'absent':''}" data-s="A">A</button><button class="att-btn ${s==='H'?'half':''}" data-s="H">H</button></div></div>`}).join('');
  list.querySelectorAll('.att-btn').forEach(btn=>btn.addEventListener('click',()=>{
    const eid=btn.closest('.att-row').dataset.id,ns=btn.dataset.s;
    if(!state.attendance[hrAttDate])state.attendance[hrAttDate]={};
    if(state.attendance[hrAttDate][eid]===ns)delete state.attendance[hrAttDate][eid];else state.attendance[hrAttDate][eid]=ns;
    save();renderHrAttendance();
  }));
}
$('#hr-att-prev-day').addEventListener('click',()=>{const d=new Date(hrAttDate+'T00:00:00');d.setDate(d.getDate()-1);hrAttDate=localDateStr(d);renderHrAttendance()});
$('#hr-att-next-day').addEventListener('click',()=>{const d=new Date(hrAttDate+'T00:00:00');d.setDate(d.getDate()+1);const newDate=localDateStr(d);if(newDate<=today()){hrAttDate=newDate;renderHrAttendance()}});
$('#hr-att-date-tap').addEventListener('click',()=>{const dp=$('#hr-att-date-picker');dp.style.position='fixed';dp.style.opacity='0';dp.style.pointerEvents='auto';try{dp.showPicker()}catch(e){dp.click()}});
$('#hr-att-date-picker').addEventListener('change',e=>{const v=e.target.value;if(v&&v<=today()){hrAttDate=v;renderHrAttendance()}e.target.style.pointerEvents='none'});

// ===== ACCOUNTANT WAGES VIEW =====
function renderAccountantWages(){
  const wages=[...state.wages].sort((a,b)=>b.month.localeCompare(a.month));
  if(!wages.length){$('#accountant-wages-empty').style.display='';$('#accountant-wages-list').innerHTML='';return}
  $('#accountant-wages-empty').style.display='none';
  let html='<table class="wage-table"><thead><tr><th>Employee</th><th>Month</th><th>Amount</th><th>Status</th></tr></thead><tbody>';
  wages.forEach(w=>{const emp=state.employees.find(e=>e.id===w.empId);html+=`<tr><td>${emp?esc(emp.name):'Unknown'}</td><td>${w.month}</td><td>₹${Number(w.amount).toLocaleString('en-IN')}</td><td><span class="task-status-badge ${w.status==='paid'?'done':'overdue'}">${w.status}</span></td></tr>`});
  html+='</tbody></table>';
  $('#accountant-wages-list').innerHTML=html;
}

// ===== SHEET HELPERS =====
function openSheet(i){
  const sheet=$('#'+i);
  const content=sheet.querySelector('.sheet-content');
  if(content&&!content.querySelector('.sheet-close-btn')){
    const btn=document.createElement('button');
    btn.className='sheet-close-btn';btn.setAttribute('aria-label','Close');btn.innerHTML='&times;';
    btn.addEventListener('click',()=>closeSheet(i));
    const handle=content.querySelector('.sheet-handle');
    if(handle)handle.after(btn);else content.prepend(btn);
  }
  sheet.classList.add('open');
}
function closeSheet(i){$('#'+i).classList.remove('open')}
$$('.sheet-overlay').forEach(o=>o.addEventListener('click',()=>o.closest('.bottom-sheet').classList.remove('open')));

// ===== INIT =====
initOnLoad();
})();
