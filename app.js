(function(){
'use strict';
const DB='kaamkar_data';
let state=load();
function defaults(){return{onboarded:false,phone:'',businessName:'',ownerName:'',businessType:'',email:'',address:'',city:'',bizState:'',pincode:'',gst:'',employees:[],attendance:{},tasks:[],wages:[],leaves:[]}}
function load(){try{const r=localStorage.getItem(DB);if(r)return{...defaults(),...JSON.parse(r)}}catch(e){}return defaults()}
function save(){localStorage.setItem(DB,JSON.stringify(state))}
function id(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
function avatarCls(i){let h=0;for(let c=0;c<i.length;c++)h=(h*31+i.charCodeAt(c))%10;return'avatar-'+h}
function ini(n){const p=n.trim().split(/\s+/);return p.length>=2?(p[0][0]+p[1][0]).toUpperCase():n.slice(0,2).toUpperCase()}
function fmtDate(d){return new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
function today(){return new Date().toISOString().slice(0,10)}
function isOverdue(t){return t.status==='pending'&&t.dueDate&&t.dueDate<today()}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function daysBetween(f,t){const days=[],d=new Date(f+'T00:00:00'),end=new Date(t+'T00:00:00');while(d<=end){days.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1)}return days}

// Toast - fixed with proper cleanup
let toastTimer=null;
function toast(msg){const t=$('#toast');if(toastTimer)clearTimeout(toastTimer);t.textContent=msg;t.classList.remove('show');void t.offsetWidth; // force reflow
t.classList.add('show');toastTimer=setTimeout(()=>{t.classList.remove('show');toastTimer=null},2500)}

function downloadCSV(fn,csv){const b=new Blob([csv],{type:'text/csv;charset=utf-8;'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=fn;a.click();URL.revokeObjectURL(u)}

// ===== SCREEN NAV =====
function showScreen(id){$$('.screen').forEach(s=>s.classList.remove('active'));$('#'+id).classList.add('active')}

// ===== ROLE SELECT =====
$('#role-owner').addEventListener('click',()=>{
  if(state.onboarded){showScreen('screen-main');initOwnerApp();return}
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
btnStart.addEventListener('click',()=>{state.businessName=bizIn.value.trim();state.ownerName=ownIn.value.trim();state.onboarded=true;save();showScreen('screen-main');initOwnerApp()});

// ===== EMPLOYEE LOGIN =====
const empLoginPhone=$('#emp-login-phone'),btnEmpLogin=$('#btn-emp-login');
empLoginPhone.addEventListener('input',()=>{empLoginPhone.value=empLoginPhone.value.replace(/\D/g,'');btnEmpLogin.disabled=empLoginPhone.value.length<10;$('#emp-login-error').style.display='none'});
btnEmpLogin.addEventListener('click',()=>{
  const ph=empLoginPhone.value;
  const emp=state.employees.find(e=>e.phone===ph);
  if(!emp){$('#emp-login-error').style.display='';return}
  currentEmpId=emp.id;
  showScreen('screen-emp-main');
  initEmployeeApp(emp);
});

// ===== INIT ON LOAD =====
function initOnLoad(){
  if(state.onboarded)showScreen('screen-role-select');
  else showScreen('screen-role-select');
}

// ===== OWNER APP =====
function initOwnerApp(){
  $('#header-business-name').textContent=state.businessName;
  renderEmployees();renderAttendance();renderTasks();renderLeaves();updateSummary();initReportDefaults();updateDropdowns();
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

function updateDropdowns(){
  const opts='<option value="">Select employee</option>'+state.employees.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('');
  const optsAll='<option value="all">All Employees</option>'+state.employees.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('');
  $('#task-assignee').innerHTML=opts;$('#leave-employee').innerHTML=opts;$('#att-report-emp').innerHTML=optsAll;$('#leave-report-emp').innerHTML=optsAll;
}

// ===== EMPLOYEES =====
function renderEmployees(){
  const emps=state.employees,search=($('#emp-search')?.value||'').toLowerCase();
  const filtered=search?emps.filter(e=>e.name.toLowerCase().includes(search)||(e.role||'').toLowerCase().includes(search)):emps;
  if(emps.length===0){$('#employees-empty').style.display='';$('#employees-list-container').style.display='none';return}
  $('#employees-empty').style.display='none';$('#employees-list-container').style.display='';
  $('#emp-count').textContent=emps.length+' employee'+(emps.length!==1?'s':'');
  const list=$('#employees-list');
  list.innerHTML=filtered.map(e=>`<div class="emp-card" data-id="${e.id}"><div class="emp-avatar ${avatarCls(e.id)}">${ini(e.name)}</div><div class="emp-info"><div class="emp-name">${esc(e.name)}</div><div class="emp-role">${esc(e.role||'No role')}</div></div><span class="emp-chevron">&#8250;</span></div>`).join('');
  list.querySelectorAll('.emp-card').forEach(c=>c.addEventListener('click',()=>showEmpDetail(c.dataset.id)));
}
$('#emp-search')?.addEventListener('input',renderEmployees);

function showEmpDetail(eid){
  const emp=state.employees.find(e=>e.id===eid);if(!emp)return;
  const wages=state.wages.filter(w=>w.empId===eid).sort((a,b)=>b.month.localeCompare(a.month));
  const lc=state.leaves.filter(l=>l.empId===eid&&l.status==='approved').length;
  const body=$('#emp-detail-body');
  body.innerHTML=`
    <div class="emp-detail-header"><div class="emp-detail-avatar ${avatarCls(emp.id)}">${ini(emp.name)}</div><div class="emp-detail-name">${esc(emp.name)}</div><div class="emp-detail-role">${esc(emp.role||'No role')}</div></div>
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-item-label">Phone</div><div class="detail-item-value">${emp.phone?'+91 '+emp.phone:'—'}</div></div>
      <div class="detail-item"><div class="detail-item-label">Joining Date</div><div class="detail-item-value">${emp.joiningDate?fmtDate(emp.joiningDate):'—'}</div></div>
      <div class="detail-item"><div class="detail-item-label">Govt ID</div><div class="detail-item-value">${emp.govtId?esc(emp.govtId):'—'}</div></div>
      <div class="detail-item"><div class="detail-item-label">Monthly Wage</div><div class="detail-item-value">${emp.wage?'Rs. '+Number(emp.wage).toLocaleString('en-IN'):'—'}</div></div>
    </div>
    <div class="detail-actions">
      <button class="detail-action-btn" data-act="edit"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit Employee</button>
      <button class="detail-action-btn" data-act="att"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Attendance History</button>
      <button class="detail-action-btn" data-act="wage"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>Log Wage Payment</button>
      ${wages.length?`<div style="margin-top:8px"><div class="detail-item-label" style="margin-bottom:8px">RECENT WAGES</div>${wages.slice(0,3).map(w=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-light);font-size:14px"><span>${w.month}</span><span style="font-weight:600">Rs. ${Number(w.amount).toLocaleString('en-IN')}</span><span class="task-status-badge ${w.status==='paid'?'done':'overdue'}">${w.status}</span></div>`).join('')}</div>`:''}
      <button class="detail-action-btn danger" data-act="delete"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Delete Employee</button>
    </div>`;
  body.querySelector('[data-act="edit"]').addEventListener('click',()=>{closeSheet('sheet-emp-detail');openEditEmp(emp)});
  body.querySelector('[data-act="att"]').addEventListener('click',()=>{closeSheet('sheet-emp-detail');showAttHistory(emp)});
  body.querySelector('[data-act="wage"]').addEventListener('click',()=>{closeSheet('sheet-emp-detail');openWage(emp)});
  body.querySelector('[data-act="delete"]').addEventListener('click',()=>{
    if(confirm('Delete '+emp.name+'?')){
      state.employees=state.employees.filter(e=>e.id!==eid);state.tasks=state.tasks.filter(t=>t.assigneeId!==eid);
      Object.keys(state.attendance).forEach(d=>delete(state.attendance[d]||{})[eid]);
      state.wages=state.wages.filter(w=>w.empId!==eid);state.leaves=state.leaves.filter(l=>l.empId!==eid);
      save();closeSheet('sheet-emp-detail');renderEmployees();renderAttendance();renderTasks();renderLeaves();updateSummary();updateDropdowns();toast('Employee deleted');
    }
  });
  openSheet('sheet-emp-detail');
}

function openAddEmp(){$('#sheet-emp-title').textContent='Add Employee';$('#emp-edit-id').value='';$('#emp-name').value='';$('#emp-role').value='';$('#emp-phone').value='';$('#emp-joining').value='';$('#emp-govtid').value='';$('#emp-wage').value='';$('#emp-optional-fields').style.display='none';$('#toggle-emp-optional').textContent='+ More details (optional)';openSheet('sheet-employee');setTimeout(()=>$('#emp-name').focus(),300)}
function openEditEmp(e){$('#sheet-emp-title').textContent='Edit Employee';$('#emp-edit-id').value=e.id;$('#emp-name').value=e.name;$('#emp-role').value=e.role||'';$('#emp-phone').value=e.phone||'';$('#emp-joining').value=e.joiningDate||'';$('#emp-govtid').value=e.govtId||'';$('#emp-wage').value=e.wage||'';if(e.joiningDate||e.govtId||e.wage){$('#emp-optional-fields').style.display='';$('#toggle-emp-optional').textContent='- Hide details'}openSheet('sheet-employee')}
$('#btn-add-first-emp').addEventListener('click',openAddEmp);$('#btn-add-emp').addEventListener('click',openAddEmp);$('#btn-cancel-emp').addEventListener('click',()=>closeSheet('sheet-employee'));
$('#toggle-emp-optional').addEventListener('click',()=>{const f=$('#emp-optional-fields'),b=$('#toggle-emp-optional');if(f.style.display==='none'){f.style.display='';b.textContent='- Hide details'}else{f.style.display='none';b.textContent='+ More details (optional)'}});
$('#form-employee').addEventListener('submit',e=>{e.preventDefault();const eid=$('#emp-edit-id').value,d={name:$('#emp-name').value.trim(),role:$('#emp-role').value.trim(),phone:$('#emp-phone').value.trim(),joiningDate:$('#emp-joining').value,govtId:$('#emp-govtid').value.trim(),wage:$('#emp-wage').value};if(!d.name)return;if(eid){const emp=state.employees.find(x=>x.id===eid);if(emp)Object.assign(emp,d);toast('Employee updated')}else{state.employees.push({id:id(),...d});toast('Employee added!')}save();closeSheet('sheet-employee');renderEmployees();renderAttendance();updateDropdowns();updateSummary()});

// ===== ATTENDANCE =====
let attDate=today();
function renderAttendance(){
  if(!state.employees.length){$('#attendance-empty').style.display='';$('#attendance-content').style.display='none';return}
  $('#attendance-empty').style.display='none';$('#attendance-content').style.display='';
  const d=new Date(attDate+'T00:00:00'),td=today();
  if(attDate===td)$('#att-date-display').textContent='Today';
  else{const y=new Date();y.setDate(y.getDate()-1);$('#att-date-display').textContent=attDate===y.toISOString().slice(0,10)?'Yesterday':d.toLocaleDateString('en-IN',{weekday:'short'})}
  $('#att-date-sub').textContent=d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
  $('#att-next-day').disabled=attDate>=td;$('#att-date-picker').value=attDate;
  const dd=state.attendance[attDate]||{},total=state.employees.length,marked=state.employees.filter(e=>dd[e.id]).length;
  const pct=total?Math.round(marked/total*100):0;$('#att-progress-fill').style.width=pct+'%';$('#att-progress-text').textContent=marked+' of '+total+' marked';
  const appLeaves={};state.leaves.filter(l=>l.status==='approved').forEach(l=>{if(daysBetween(l.fromDate,l.toDate).includes(attDate))appLeaves[l.empId]=l.type});
  const list=$('#attendance-list');
  list.innerHTML=state.employees.map(emp=>{const s=dd[emp.id]||'',ol=appLeaves[emp.id];return`<div class="att-row" data-id="${emp.id}"><div class="emp-avatar ${avatarCls(emp.id)}" style="width:36px;height:36px;font-size:13px">${ini(emp.name)}</div><div style="flex:1;min-width:0"><span class="att-name">${esc(emp.name)}</span>${ol?`<span class="att-leave-tag">${ol} leave</span>`:''}</div><div class="att-buttons"><button class="att-btn ${s==='P'?'present':''}" data-s="P">P</button><button class="att-btn ${s==='A'?'absent':''}" data-s="A">A</button><button class="att-btn ${s==='H'?'half':''}" data-s="H">H</button></div></div>`}).join('');
  list.querySelectorAll('.att-btn').forEach(btn=>btn.addEventListener('click',()=>{
    const eid=btn.closest('.att-row').dataset.id,ns=btn.dataset.s;
    if(!state.attendance[attDate])state.attendance[attDate]={};
    if(state.attendance[attDate][eid]===ns)delete state.attendance[attDate][eid];else state.attendance[attDate][eid]=ns;
    save();renderAttendance();updateSummary();
  }));
}
$('#att-prev-day').addEventListener('click',()=>{const d=new Date(attDate+'T00:00:00');d.setDate(d.getDate()-1);attDate=d.toISOString().slice(0,10);renderAttendance()});
$('#att-next-day').addEventListener('click',()=>{const d=new Date(attDate+'T00:00:00');d.setDate(d.getDate()+1);if(d.toISOString().slice(0,10)<=today()){attDate=d.toISOString().slice(0,10);renderAttendance()}});

// Date picker - tap on date display
$('#att-date-tap').addEventListener('click',()=>{const dp=$('#att-date-picker');dp.style.position='fixed';dp.style.opacity='0';dp.style.pointerEvents='auto';dp.showPicker?dp.showPicker():dp.click()});
$('#att-date-picker').addEventListener('change',e=>{const v=e.target.value;if(v&&v<=today()){attDate=v;renderAttendance()}e.target.style.pointerEvents='none'});

function showAttHistory(emp){
  $('#att-history-title').textContent=emp.name+' - Attendance';const body=$('#att-history-body'),td=new Date(),days=[];
  for(let i=29;i>=0;i--){const d=new Date(td);d.setDate(d.getDate()-i);const ds=d.toISOString().slice(0,10);days.push({date:d,dateStr:ds,status:(state.attendance[ds]||{})[emp.id]||null})}
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
  const body=$('#leave-detail-body');
  body.innerHTML=`<h3 class="sheet-title">Leave Request</h3><div class="task-detail-info" style="border-top:none;padding-top:0"><div class="task-detail-row"><span class="task-detail-label">Employee</span><span class="task-detail-value">${emp?esc(emp.name):'Unknown'}</span></div><div class="task-detail-row"><span class="task-detail-label">Type</span><span class="task-detail-value" style="text-transform:capitalize">${leave.type} Leave</span></div><div class="task-detail-row"><span class="task-detail-label">From</span><span class="task-detail-value">${fmtDate(leave.fromDate)}</span></div><div class="task-detail-row"><span class="task-detail-label">To</span><span class="task-detail-value">${fmtDate(leave.toDate)}</span></div><div class="task-detail-row"><span class="task-detail-label">Duration</span><span class="task-detail-value">${days} day${days!==1?'s':''}</span></div>${leave.reason?`<div class="task-detail-row"><span class="task-detail-label">Reason</span><span class="task-detail-value">${esc(leave.reason)}</span></div>`:''}<div class="task-detail-row"><span class="task-detail-label">Status</span><span class="task-status-badge ${leave.status}">${leave.status}</span></div></div><div class="task-detail-actions">${leave.status==='pending'?'<button class="btn btn-accent" data-act="approve">Approve</button><button class="btn btn-danger-outline" data-act="reject">Reject</button>':''}${leave.status==='approved'?'<button class="btn btn-warning" data-act="revoke">Revoke</button>':''}${leave.status==='rejected'?'<button class="btn btn-accent" data-act="approve">Approve</button>':''}<button class="btn btn-ghost" data-act="delete">Delete</button></div>`;
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
  list.innerHTML=f.map(t=>{const emp=state.employees.find(e=>e.id===t.assigneeId),sc=t.displayStatus;return`<div class="task-card ${sc}" data-id="${t.id}"><div class="task-title-row"><span class="task-title">${esc(t.title)}</span><span class="task-status-badge ${sc}">${sc}</span></div><div class="task-meta"><span class="task-meta-item"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${emp?esc(emp.name):'Unassigned'}</span>${t.dueDate?`<span class="task-meta-item"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${fmtDate(t.dueDate)}</span>`:''}</div></div>`}).join('');
  list.querySelectorAll('.task-card').forEach(c=>c.addEventListener('click',()=>showTaskDetail(c.dataset.id)));
}
$$('[data-filter]').forEach(c=>c.addEventListener('click',()=>{$$('[data-filter]').forEach(x=>x.classList.remove('active'));c.classList.add('active');taskFilter=c.dataset.filter;renderTasks()}));

function showTaskDetail(tid,isEmp){
  const task=state.tasks.find(t=>t.id===tid);if(!task)return;
  const emp=state.employees.find(e=>e.id===task.assigneeId),sc=isOverdue(task)?'overdue':task.status;
  const body=$('#task-detail-body');
  body.innerHTML=`<div class="task-detail-header"><div class="task-detail-title">${esc(task.title)}</div><span class="task-status-badge ${sc} task-detail-status">${sc}</span></div><div class="task-detail-info"><div class="task-detail-row"><span class="task-detail-label">Assigned To</span><span class="task-detail-value">${emp?esc(emp.name):'Unassigned'}</span></div><div class="task-detail-row"><span class="task-detail-label">Due Date</span><span class="task-detail-value">${task.dueDate?fmtDate(task.dueDate):'No due date'}</span></div><div class="task-detail-row"><span class="task-detail-label">Created</span><span class="task-detail-value">${fmtDate(task.createdAt)}</span></div></div><div class="task-detail-actions">${task.status!=='done'?'<button class="btn btn-accent" data-act="done">Mark as Done</button>':'<button class="btn btn-outline" data-act="reopen">Reopen</button>'}${isEmp?'':'<button class="btn btn-danger-outline" data-act="delete">Delete</button>'}</div>`;
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
$('#form-task').addEventListener('submit',e=>{e.preventDefault();const title=$('#task-title').value.trim(),assignee=$('#task-assignee').value,due=$('#task-due').value;if(!title)return;state.tasks.push({id:id(),title,assigneeId:assignee,dueDate:due,status:'pending',createdAt:today()});save();closeSheet('sheet-task');renderTasks();updateSummary();const emp=state.employees.find(e=>e.id===assignee);toast(emp?'Task assigned to '+emp.name:'Task created!')});

// ===== WAGES =====
function openWage(emp){$('#wage-emp-id').value=emp.id;$('#wage-emp-name').value=emp.name;const n=new Date();$('#wage-month').value=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0');$('#wage-amount').value=emp.wage||'';$$('.wage-status-btn').forEach(b=>b.classList.remove('active'));$('.wage-status-btn[data-status="paid"]').classList.add('active');openSheet('sheet-wage')}
$$('.wage-status-btn').forEach(b=>b.addEventListener('click',()=>{$$('.wage-status-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active')}));
$('#btn-cancel-wage').addEventListener('click',()=>closeSheet('sheet-wage'));
$('#form-wage').addEventListener('submit',e=>{e.preventDefault();const eid=$('#wage-emp-id').value,month=$('#wage-month').value,amount=$('#wage-amount').value,status=$('.wage-status-btn.active')?.dataset.status||'paid';if(!amount)return;const ex=state.wages.find(w=>w.empId===eid&&w.month===month);if(ex){ex.amount=amount;ex.status=status}else state.wages.push({id:id(),empId:eid,month,amount,status});save();closeSheet('sheet-wage');toast('Wage recorded')});

// ===== REPORTS =====
$$('.report-type-tab').forEach(t=>t.addEventListener('click',()=>{$$('.report-type-tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');$$('.report-panel').forEach(p=>p.classList.remove('active'));$('#report-'+t.dataset.report).classList.add('active')}));

function initReportDefaults(){const n=new Date(),f=new Date(n.getFullYear(),n.getMonth(),1);$('#att-report-from').value=f.toISOString().slice(0,10);$('#att-report-to').value=today();const m=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0');$('#wage-report-from').value=m;$('#wage-report-to').value=m}

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
  let csv='Employee,Role,Phone,Month,Amount (Rs),Status\n';
  wf.forEach(w=>{const emp=state.employees.find(e=>e.id===w.empId);csv+=`"${emp?emp.name:'Unknown'}","${emp?emp.role||'':''}","${emp?emp.phone||'':''}","${w.month}",${w.amount},"${w.status}"\n`});
  downloadCSV('wages-'+from+'-to-'+to+'.csv',csv);toast('Report downloaded');
});
$('#btn-download-emp-report').addEventListener('click',()=>{
  if(!state.employees.length){toast('No employees');return}
  let csv='Name,Role,Phone,Joining Date,Govt ID,Monthly Wage (Rs)\n';
  state.employees.forEach(e=>csv+=`"${e.name}","${e.role||''}","${e.phone||''}","${e.joiningDate||''}","${e.govtId||''}","${e.wage||''}"\n`);
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
  $('#summary-employees').textContent=state.employees.length;
  const td=state.attendance[today()]||{};$('#summary-present').textContent=Object.values(td).filter(v=>v==='P'||v==='H').length;
  $('#summary-tasks-pending').textContent=state.tasks.filter(t=>t.status==='pending').length;
  $('#summary-tasks-overdue').textContent=state.tasks.filter(t=>isOverdue(t)).length;
}

// ===== SETTINGS =====
$('#btn-settings').addEventListener('click',()=>{$('#settings-business').value=state.businessName;$('#settings-owner').value=state.ownerName;$('#settings-biz-type').value=state.businessType||'';$('#settings-phone').value=state.phone;$('#settings-email').value=state.email||'';$('#settings-address').value=state.address||'';$('#settings-city').value=state.city||'';$('#settings-state').value=state.bizState||'';$('#settings-pincode').value=state.pincode||'';$('#settings-gst').value=state.gst||'';openSheet('sheet-settings')});
$('#btn-save-settings').addEventListener('click',()=>{state.businessName=$('#settings-business').value.trim()||state.businessName;state.ownerName=$('#settings-owner').value.trim()||state.ownerName;state.businessType=$('#settings-biz-type').value;state.phone=$('#settings-phone').value.trim();state.email=$('#settings-email').value.trim();state.address=$('#settings-address').value.trim();state.city=$('#settings-city').value.trim();state.bizState=$('#settings-state').value.trim();state.pincode=$('#settings-pincode').value.trim();state.gst=$('#settings-gst').value.trim();save();$('#header-business-name').textContent=state.businessName;closeSheet('sheet-settings');toast('Profile saved')});
$('#btn-export-data').addEventListener('click',()=>{const b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='kaamkar-backup-'+today()+'.json';a.click();URL.revokeObjectURL(u);toast('Data exported')});
$('#btn-logout').addEventListener('click',()=>{if(confirm('Logout? You can export a backup first.')){localStorage.removeItem(DB);state=defaults();phoneIn.value='';otpBoxes.forEach(b=>b.value='');bizIn.value='';ownIn.value='';btnOtp.disabled=true;$('#btn-verify-otp').disabled=true;btnStart.disabled=true;closeSheet('sheet-settings');showScreen('screen-role-select');toast('Logged out')}});

// ===== EMPLOYEE APP =====
let currentEmpId=null;

function initEmployeeApp(emp){
  currentEmpId=emp.id;
  $('#emp-header-name').textContent=emp.name;
  renderEmpTasks();renderEmpAttendance();renderEmpLeaves();
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

function renderEmpAttendance(){
  const body=$('#emp-att-summary'),hist=$('#emp-att-history');
  const td=new Date(),days=[];
  for(let i=29;i>=0;i--){const d=new Date(td);d.setDate(d.getDate()-i);days.push({date:d,ds:d.toISOString().slice(0,10)})}
  let p=0,a=0,h=0;
  days.forEach(d=>{const s=(state.attendance[d.ds]||{})[currentEmpId];if(s==='P')p++;else if(s==='A')a++;else if(s==='H')h++});
  body.innerHTML=`<div class="emp-att-stat"><span class="stat-num stat-present">${p}</span><span class="stat-label">Present</span></div><div class="emp-att-stat"><span class="stat-num stat-absent">${a}</span><span class="stat-label">Absent</span></div><div class="emp-att-stat"><span class="stat-num stat-half">${h}</span><span class="stat-label">Half Day</span></div>`;
  hist.innerHTML=`<div style="padding:0 16px 16px"><h4 style="font-size:14px;font-weight:700;color:var(--text-secondary);margin-bottom:8px">LAST 30 DAYS</h4>${days.map(d=>{const s=(state.attendance[d.ds]||{})[currentEmpId];return`<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light)"><span style="font-size:14px;color:var(--text-secondary)">${d.date.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</span><span class="att-history-cell ${s==='P'?'present':s==='A'?'absent':s==='H'?'half':''}">${s==='P'?'Present':s==='A'?'Absent':s==='H'?'Half Day':'—'}</span></div>`}).join('')}</div>`;
}

function renderEmpLeaves(){
  const leaves=state.leaves.filter(l=>l.empId===currentEmpId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  if(!leaves.length){$('#emp-leaves-empty').style.display='';$('#emp-leaves-list').innerHTML='';return}
  $('#emp-leaves-empty').style.display='none';
  $('#emp-leaves-list').innerHTML=leaves.map(l=>`<div class="leave-card ${l.status}" data-id="${l.id}"><div class="leave-card-header"><div><span class="leave-type-badge">${l.type} leave</span></div><span class="task-status-badge ${l.status}">${l.status}</span></div><div class="leave-card-meta"><span>${fmtDate(l.fromDate)} — ${fmtDate(l.toDate)}</span>${l.reason?`<span>${esc(l.reason)}</span>`:''}</div></div>`).join('');
  $('#emp-leaves-list').querySelectorAll('.leave-card').forEach(c=>c.addEventListener('click',()=>showLeaveDetail(c.dataset.id)));
}

$('#btn-emp-request-leave').addEventListener('click',()=>openLeaveSheet(currentEmpId,true));

// Employee profile
$('#btn-emp-profile').addEventListener('click',()=>{
  const emp=state.employees.find(e=>e.id===currentEmpId);if(!emp)return;
  const body=$('#emp-profile-body');
  body.innerHTML=`<div class="emp-detail-header"><div class="emp-detail-avatar ${avatarCls(emp.id)}">${ini(emp.name)}</div><div class="emp-detail-name">${esc(emp.name)}</div><div class="emp-detail-role">${esc(emp.role||'No role')}</div></div><div class="detail-grid"><div class="detail-item"><div class="detail-item-label">Phone</div><div class="detail-item-value">${emp.phone?'+91 '+emp.phone:'—'}</div></div><div class="detail-item"><div class="detail-item-label">Joining Date</div><div class="detail-item-value">${emp.joiningDate?fmtDate(emp.joiningDate):'—'}</div></div></div><div style="padding-top:16px"><button class="btn btn-danger-outline btn-full" id="btn-emp-logout"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>Logout</button></div>`;
  body.querySelector('#btn-emp-logout').addEventListener('click',()=>{currentEmpId=null;closeSheet('sheet-emp-profile');showScreen('screen-role-select');toast('Logged out')});
  openSheet('sheet-emp-profile');
});

// ===== SHEET HELPERS =====
function openSheet(i){$('#'+i).classList.add('open')}
function closeSheet(i){$('#'+i).classList.remove('open')}
$$('.sheet-overlay').forEach(o=>o.addEventListener('click',()=>o.closest('.bottom-sheet').classList.remove('open')));

// ===== INIT =====
initOnLoad();
})();
