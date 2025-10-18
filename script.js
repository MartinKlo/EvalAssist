
// Sidebar toggle script
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const selectedProjectEl = document.getElementById('selectedProject');
const overlay = document.getElementById('overlay');
const body = document.body;

function setSidebarOpen(open){
		sidebar.classList.toggle('open', open);
	menuToggle.setAttribute('aria-expanded', String(Boolean(open)));
	sidebar.setAttribute('aria-hidden', String(!open));
	if(open){
		overlay.hidden = false;
		// focus the first link in the sidebar for keyboard users
		const firstLink = sidebar.querySelector('.project-link');
		if(firstLink) firstLink.focus();
	} else {
		overlay.hidden = true;
		menuToggle.focus();
	}
}

menuToggle.addEventListener('click', () => {
	const isOpen = sidebar.classList.contains('open');
	setSidebarOpen(!isOpen);
});

overlay.addEventListener('click', () => setSidebarOpen(false));

sidebar.addEventListener('click', (e) => {
	const link = e.target.closest('.project-link');
	if(link){
		// mark active
		sidebar.querySelectorAll('.project-link').forEach(a=>a.classList.remove('active'));
		link.classList.add('active');
		const projectName = link.textContent.trim();
		selectedProjectEl.textContent = 'Selected project: ' + projectName;
		// persist selection
		try{ localStorage.setItem(SELECTED_PROJECT_KEY, projectName); }catch(e){}
		setSidebarOpen(false);
		// attempt to load the project's template JSON from the Templates/ folder
		try{ loadProjectTemplate(projectName).then(()=>{
			renderTemplateEditor();
			populateResponseSelects();
			applySavedIncludeStatesForProject(projectName);
			renderSectionsForProject(projectName);
			updatePreview();
		}).catch(()=>{}); }catch(e){}
	}
});

document.addEventListener('keydown', (e) => {
	if(e.key === 'Escape' && sidebar.classList.contains('open')){
		setSidebarOpen(false);
	}
});

// Theme toggle logic
const themeToggle = document.getElementById('themeToggle');
function applyTheme(theme){
	if(theme === 'dark'){
		document.documentElement.setAttribute('data-theme','dark');
		themeToggle.setAttribute('aria-pressed','true');
		themeToggle.textContent = '☀️';
	} else {
		document.documentElement.removeAttribute('data-theme');
		themeToggle.setAttribute('aria-pressed','false');
		themeToggle.textContent = '🌙';
	}
}

function initTheme(){
	const stored = localStorage.getItem('theme');
	if(stored) return applyTheme(stored);
	// fallback to system preference
	const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
	applyTheme(prefersDark ? 'dark' : 'light');
}

themeToggle.addEventListener('click', ()=>{
	const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
	const next = isDark ? 'light' : 'dark';
	applyTheme(next);
	localStorage.setItem('theme', next);
});

initTheme();

// --- Tabs and Evaluation logic ---
// Tab handling: support dynamic tabs (Evaluation, Template, Blanks, etc.)
const allTabs = Array.from(document.querySelectorAll('[role="tab"]'));
function activateTab(tab){
	// deactivate all tabs and hide their panels
	allTabs.forEach(t => t.setAttribute('aria-selected','false'));
	allTabs.forEach(t => {
		const p = document.getElementById(t.getAttribute('aria-controls'));
		if(p) p.hidden = true;
	});
	// activate selected
	tab.setAttribute('aria-selected','true');
	const panel = document.getElementById(tab.getAttribute('aria-controls'));
	if(panel) panel.hidden = false;
}

// Wire click handlers for all tabs
allTabs.forEach(t => t.addEventListener('click', ()=> activateTab(t)));

// Form / evaluation store
const evalForm = document.getElementById('evalForm');

// Feedback templates stored in localStorage — map keys to template text
// Example CSV format expected: key,template
// Keys might be 'quality:excellent', 'completeness:partial', 'check:hasReferences', etc.
// legacy: flat templates mapping; new: templates mem map per project in `templatesMem`
// Templates are stored in-memory only. We intentionally do NOT persist
// template mappings to localStorage. This prevents stale/local copies from
// overriding the on-disk Templates/ JSON files.
let templatesMem = {};
const TEMPLATES_KEY = 'eval_feedback_templates_v1';
const DEFAULT_PROJECT_KEY = '__global__';
const SELECTED_PROJECT_KEY = 'selected_project_v1';
const INCLUDE_STATE_KEY = 'eval_template_include_state_v1';
const EVALUATOR_NAME = 'Evaluator';

// Evaluator/account settings keys
const EVALUATOR_NAME_KEY = 'eval_evaluator_name_v1';

// account dialog elements (created in DOM)
const accountBtn = document.getElementById('accountBtn');
const accountDialog = document.getElementById('accountDialog');
const evaluatorNameInput = document.getElementById('evaluatorName');

function loadEvaluatorName(){
	try{
		const name = localStorage.getItem(EVALUATOR_NAME_KEY);
		if(name && evaluatorNameInput) evaluatorNameInput.value = name;
	}catch(e){}
}

function saveEvaluatorName(){
	try{
		const val = evaluatorNameInput ? (evaluatorNameInput.value || '') : '';
		localStorage.setItem(EVALUATOR_NAME_KEY, val);
		// update the in-memory constant for display (used when generating comments)
		// We intentionally do not reassign the const; instead, store on window for generateComments to read
		window.__EVALUATOR_NAME = val;
	}catch(e){ console.warn('Failed to save evaluator name', e); }
}

// open dialog when account button clicked
// Helper to open/close dialog with a fallback when <dialog> API isn't supported
function openAccountDialog(){
	loadEvaluatorName();
	try{
		if(accountDialog && typeof accountDialog.showModal === 'function'){
			accountDialog.showModal();
			return;
		}
	}catch(e){ console.warn('dialog.showModal failed', e); }
	// fallback: make dialog-like element visible
	if(accountDialog){
		accountDialog.setAttribute('open','');
		accountDialog.style.display = 'block';
		accountDialog.style.position = 'fixed';
		accountDialog.style.left = '50%';
		accountDialog.style.top = '50%';
		accountDialog.style.transform = 'translate(-50%,-50%)';
		accountDialog.setAttribute('aria-hidden','false');
	}
}

function closeAccountDialog(){
	try{
		if(accountDialog && typeof accountDialog.close === 'function'){
			accountDialog.close();
			return;
		}
	}catch(e){ /* ignore */ }
	if(accountDialog){
		accountDialog.removeAttribute('open');
		accountDialog.style.display = 'none';
		accountDialog.setAttribute('aria-hidden','true');
	}
}

if(accountBtn){
	accountBtn.addEventListener('click', ()=>{
		try{ openAccountDialog(); }catch(e){ console.warn(e); }
	});
}

// close dialog handler
const closeEvaluator = document.getElementById('closeEvaluator');
if(closeEvaluator){ closeEvaluator.addEventListener('click', ()=> closeAccountDialog()); }

// save handler on dialog form submission
const accountForm = document.getElementById('accountForm');
if(accountForm){
	accountForm.addEventListener('submit', (e)=>{
		e.preventDefault();
		saveEvaluatorName();
		accountDialog.close();
		showToast('Evaluator name saved');
	});
}

// ensure global evaluator name value available for generateComments
window.__EVALUATOR_NAME = (function(){ try{ return localStorage.getItem(EVALUATOR_NAME_KEY) || EVALUATOR_NAME; }catch(e){ return EVALUATOR_NAME; } })();

// No-op loaders for persistent templates. We intentionally do not save
// templates to localStorage. Use the in-memory map `templatesMem` and
// prefer JSON files under Templates/ loaded via fetch.
function loadTemplates(){ /* intentionally no-op */ }
function saveTemplates(){ /* intentionally no-op */ }

function loadSelectedProject(){
	try{
		const sel = localStorage.getItem(SELECTED_PROJECT_KEY);
		if(!sel) return;
		// find link matching the stored name and activate it
		const links = Array.from(sidebar.querySelectorAll('.project-link'));
		const match = links.find(a => a.textContent.trim() === sel);
		if(match){
			links.forEach(a=>a.classList.remove('active'));
			match.classList.add('active');
			selectedProjectEl.textContent = 'Selected project: ' + sel;
		}
	}catch(e){}
}

function getCurrentProjectName(){
	// priority: active sidebar item -> stored selected project -> default
	const active = sidebar.querySelector('.project-link.active');
	if(active) return active.textContent.trim();
	try{ const stored = localStorage.getItem(SELECTED_PROJECT_KEY); if(stored) return stored; }catch(e){}
	return DEFAULT_PROJECT_KEY;
}

// Template editor helpers
const editorProjectLabel = document.getElementById('editorProject');
const exportTemplatesBtn = document.getElementById('exportTemplates');
const clearTemplatesBtn = document.getElementById('clearTemplates');

function renderTemplateEditor(){
	const proj = getCurrentProjectName();
	editorProjectLabel.textContent = proj === DEFAULT_PROJECT_KEY ? 'Global' : proj;
	// ensure an in-memory map exists for the project so selects and imports have a place to merge
	templatesMem[proj] = templatesMem[proj] || {};
}

// Project JSON storage: each project may provide a structured JSON defining sections and responses.
// We'll keep a separate in-memory map projectJsons[projectName] = { name, sections: [ { id, title, responses: [ { id, name, include, options: [keys...] } ] } ] }
const projectJsons = {};

// We no longer synthesise project JSONs from a persisted templates map. 
// Project JSONs come either from the Templates/ folder or from uploaded
// structured JSON files and are kept only in-memory (projectJsons).

function ensureProjectJson(proj){
	projectJsons[proj] = projectJsons[proj] || { name: proj === DEFAULT_PROJECT_KEY ? 'Global' : proj, sections: [ { id: 'general', title: 'General', responses: [ { id: 'r1', name: 'Response 1', include: true, options: [] }, { id: 'r2', name: 'Response 2', include: true, options: [] }, { id: 'r3', name: 'Response 3', include: true, options: [] } ] } ] };
}

// Render evaluation sections (left side) and templateIncludes (right side) from the projectJsons for current project
function renderSectionsForProject(proj){
	ensureProjectJson(proj);
	const pj = projectJsons[proj];
	const evalContainer = document.getElementById('evalSections');
	const tmplContainer = document.getElementById('templateIncludes');
	evalContainer.innerHTML = '';
	tmplContainer.innerHTML = '';

	pj.sections.forEach((sec, sIndex) => {
		// Evaluation panel details
	const dEval = document.createElement('details');
	// Open collapsible sections by default
	dEval.open = true;
		const s = document.createElement('summary'); s.textContent = sec.title;
		dEval.appendChild(s);
		const rows = document.createElement('div'); rows.className = 'section-rows';
		sec.responses.forEach((resp, rIndex) => {
			const row = document.createElement('div'); row.className = 'response-row'; row.setAttribute('data-section', sec.id); row.setAttribute('data-index', String(rIndex+1));
			const label = document.createElement('span'); label.className = 'response-label'; label.textContent = resp.name || ('Response ' + (rIndex+1));
			const sel = document.createElement('select'); sel.className = 'response-select'; sel.setAttribute('data-section', sec.id); sel.setAttribute('data-index', String(rIndex+1)); sel.setAttribute('aria-label', sec.title + ' response ' + (rIndex+1));
			rows.appendChild(row); row.appendChild(label); row.appendChild(sel);
		});
		dEval.appendChild(rows);
		evalContainer.appendChild(dEval);

		// Template-includes panel details
		const dT = document.createElement('details');
		if(sIndex === 0) dT.open = true;
		const sT = document.createElement('summary'); sT.textContent = sec.title + ' (Include/Exclude)';
		dT.appendChild(sT);
		const trows = document.createElement('div'); trows.className = 'section-rows';
		sec.responses.forEach((resp, rIndex) => {
			const trow = document.createElement('div'); trow.className = 'response-row';
			const chk = document.createElement('input'); chk.type = 'checkbox'; chk.className = 'include-checkbox'; chk.id = 'tinclude-' + sec.id + '-' + (rIndex+1);
			chk.setAttribute('data-section', sec.id); chk.setAttribute('data-index', String(rIndex+1)); chk.checked = !!resp.include;
			const label = document.createElement('span'); label.className = 'response-label'; label.textContent = resp.name || ('Response ' + (rIndex+1));
			trow.appendChild(chk); trow.appendChild(label);
			trows.appendChild(trow);
		});
		dT.appendChild(trows);
		tmplContainer.appendChild(dT);
	});

	// after DOM injection, repopulate selects with available template keys for current project
	populateResponseSelects();
	// attach live-sync listeners for new checkboxes
	document.querySelectorAll('.template-includes .include-checkbox').forEach(chk => {
		chk.addEventListener('change', () => applyIncludeStatesToEvalUI());
	});
	// apply saved include states for project
	applySavedIncludeStatesForProject(proj);
	// ensure include states applied to UI
	applyIncludeStatesToEvalUI();

	// --- LevelUp: make the "Attempted" response control inclusion of other LevelUp responses ---
	function enforceLevelUpIncludesForProject(projectName){
		// find all selects in the LevelUp section for the current UI
		const levelupSelects = Array.from(document.querySelectorAll('.response-select[data-section="levelup"]'));
		let attemptIndex = null;
		let attemptVal = '';
		levelupSelects.forEach(sel => {
			const row = sel.closest('.response-row');
			const labelEl = row ? row.querySelector('.response-label') : null;
			const label = labelEl ? (labelEl.textContent || '').trim() : '';
			const idx = sel.getAttribute('data-index');
			if(/attempted/i.test(label)){
				attemptIndex = idx;
				attemptVal = sel.value || '';
			}
		});
		// If attempted == 'Yes', include others; otherwise exclude others (also covers empty)
		const includeOthers = (attemptVal === 'Yes');
		// toggle include-checkboxes for levelup responses (excluding the Attempted one)
		document.querySelectorAll('.template-includes .include-checkbox[data-section="levelup"]').forEach(chk => {
			const idx = chk.getAttribute('data-index');
			if(idx === attemptIndex) return; // skip Attempted checkbox itself
			try{ chk.checked = !!includeOthers; }catch(e){}
		});
		// apply to UI and persist
		applyIncludeStatesToEvalUI();
	}

	// attach change handlers to the Attempted select (if present) and enforce initial state
	document.querySelectorAll('.response-select[data-section="levelup"]').forEach(sel => {
		const row = sel.closest('.response-row');
		const labelEl = row ? row.querySelector('.response-label') : null;
		const label = labelEl ? (labelEl.textContent || '') : '';
		if(/attempted/i.test(label)){
			sel.addEventListener('change', () => enforceLevelUpIncludesForProject(proj));
		}
	});

	// enforce on initial render
	enforceLevelUpIncludesForProject(proj);
}

// Helper to import a project JSON (strict schema) and store in projectJsons (in-memory)
function importProjectJson(proj, jsonObj){
	// expected shape: { name: "Project Name", sections: [ { id: "s1", title: "Section 1", responses: [ { id: "r1", name: "Response 1", include: true, options: ["key1","key2"] } ] } ] }
	// Store structured project JSON in-memory only. We intentionally do not persist
	// the project JSON to localStorage so the Templates/ folder remains the
	// authoritative source on disk.
	projectJsons[proj] = jsonObj;
	// If the user previously saved include/exclude states for this project, they may
	// override the `include` flags from the newly imported JSON. Clear any saved
	// include-state for this project so the JSON's include/defaults take effect.
	try{
		const raw = localStorage.getItem(INCLUDE_STATE_KEY);
		const states = raw ? JSON.parse(raw) : {};
		if(states && states[proj]){
			delete states[proj];
			localStorage.setItem(INCLUDE_STATE_KEY, JSON.stringify(states));
		}
	}catch(e){ console.warn('Failed to clear saved include states for project', proj, e); }

	// populate template keys in each response options if provided and render UI
	renderSectionsForProject(proj);
}

// Populate response selects in the evaluation form with available template keys for the current project
function populateResponseSelects(){
	const selects = Array.from(document.querySelectorAll('.response-select'));
	const proj = getCurrentProjectName();
	const map = templatesMem[proj] || templatesMem[DEFAULT_PROJECT_KEY] || {};
	// filter out reserved/internal keys (like the persisted project JSON) so they don't appear as template options
	const keys = Object.keys(map).filter(k => k !== '__project_json' && k !== '').sort();
	selects.forEach(sel => {
		// determine which options to show: prefer per-response options from projectJsons
		const section = sel.getAttribute('data-section');
		const index = parseInt(sel.getAttribute('data-index') || '1', 10) - 1; // 0-based
		let optionKeys = null;
		const projJson = projectJsons[proj];
		if(projJson && Array.isArray(projJson.sections)){
			const sec = projJson.sections.find(s => s.id === section);
			if(sec && Array.isArray(sec.responses) && sec.responses[index]){
				const respDef = sec.responses[index];
				// respDef.options may be:
				// - an array of strings (labels) => we treat as inline labels but mark NEED FEEDBACK
				// - an array of objects { key, text } => handled below
				// - an object map { key: feedback }
				if(respDef.options){
					if(Array.isArray(respDef.options) && respDef.options.length) optionKeys = respDef.options.slice();
					else if(typeof respDef.options === 'object' && respDef.options !== null) optionKeys = Object.assign({}, respDef.options);
				}
			}
		}
		if(!optionKeys) optionKeys = keys.slice();

		// clear and populate
		sel.innerHTML = '';
		const empty = document.createElement('option'); empty.value = ''; empty.textContent = '-- choose response --';
		sel.appendChild(empty);
		// Build options. optionKeys may be:
		// - an array (legacy or per-response strings/objects)
		// - an object (map from key -> feedback text)
		if(Array.isArray(optionKeys)){
			// per-response array
			optionKeys.forEach(k => {
				const opt = document.createElement('option');
					if(typeof k === 'string'){
						// array-of-strings: label only; inline text should come from JSON or templates
						opt.value = k;
						opt.textContent = k;
				} else if(k && typeof k === 'object'){
					const key = k.key || k.text || '';
					opt.value = key;
					opt.textContent = k.text || key;
					if(k.text) opt.dataset.inlineText = k.text;
					if(k.key && !map.hasOwnProperty(k.key)) opt.textContent += ' (missing key)';
				}
				sel.appendChild(opt);
			});
		} else if(optionKeys && typeof optionKeys === 'object'){
			// object map: key -> feedback
			Object.keys(optionKeys).forEach(k => {
				const opt = document.createElement('option');
				opt.value = k;
				opt.textContent = k;
				// only attach inlineText when actual feedback text exists in the map
				if(optionKeys[k] != null && optionKeys[k] !== '') opt.dataset.inlineText = String(optionKeys[k]);
				sel.appendChild(opt);
			});
		}
		// normalize option keys for membership checks (optionKeys can contain objects or strings)
		let normalizedOptionKeys = [];
		if(Array.isArray(optionKeys)){
			normalizedOptionKeys = optionKeys.map(k => (typeof k === 'string') ? k : (k && (k.key || k.text) ? (k.key || k.text) : ''));
		} else if(optionKeys && typeof optionKeys === 'object'){
			normalizedOptionKeys = Object.keys(optionKeys);
		}
		// if current value no longer in list, clear selection
		if(sel.value && !normalizedOptionKeys.includes(sel.value)) sel.value = '';
	});
	// re-apply include/excluded UI states
	applyIncludeStatesToEvalUI();
}

// Apply include/exclude states from Template tab to Evaluation UI
function applyIncludeStatesToEvalUI(){
		document.querySelectorAll('.template-includes .include-checkbox').forEach(chk => {
			const section = chk.getAttribute('data-section');
			const index = chk.getAttribute('data-index');
			if(!section || !index) return;
			// selects carry the data attributes in the Evaluation panel; find the select then its parent row
			const evalSelect = document.querySelector('.response-select[data-section="'+section+'"][data-index="'+index+'"]');
			const evalRow = evalSelect ? evalSelect.closest('.response-row') : null;
			if(evalRow){
				if(!chk.checked){
					evalRow.classList.add('excluded');
					evalRow.setAttribute('aria-hidden','true');
				} else {
					evalRow.classList.remove('excluded');
					evalRow.removeAttribute('aria-hidden');
				}
			}
			if(evalSelect){
				// keep select disabled when excluded to prevent accidental focus
				evalSelect.disabled = !chk.checked;
			}
		});
	// persist states per project
	try{
		const project = getCurrentProjectName();
		const raw = localStorage.getItem(INCLUDE_STATE_KEY);
		const states = raw ? JSON.parse(raw) : {};
		states[project] = states[project] || {};
		document.querySelectorAll('.template-includes .include-checkbox').forEach(chk => {
			states[project][chk.id] = !!chk.checked;
		});
		localStorage.setItem(INCLUDE_STATE_KEY, JSON.stringify(states));
	}catch(e){ console.warn('Failed to persist include states', e); }
}

function applySavedIncludeStatesForProject(project){
	try{
		const raw = localStorage.getItem(INCLUDE_STATE_KEY);
		const states = raw ? JSON.parse(raw) : {};
		const map = states[project] || {};
		document.querySelectorAll('.template-includes .include-checkbox').forEach(chk => {
			if(map.hasOwnProperty(chk.id)) chk.checked = !!map[chk.id];
		});
		applyIncludeStatesToEvalUI();
	}catch(e){ console.warn('Failed to load include states', e); }
}

// Collect selected template keys where include-checkbox is checked
function collectSelectedResponseKeys(){
	// Use the explicit data attributes on the include-checkboxes to find corresponding selects
	const selected = [];
	document.querySelectorAll('.template-includes .include-checkbox').forEach(chk => {
		if(!chk.checked) return;
		const section = chk.getAttribute('data-section');
		const index = chk.getAttribute('data-index');
		if(!section || !index) return;
		const sel = document.querySelector('.response-select[data-section="'+section+'"][data-index="'+index+'"]');
		if(sel && sel.value){
			const opt = sel.querySelector('option[value="'+CSS.escape(sel.value)+'"]');
			const inlineText = opt && opt.dataset && opt.dataset.inlineText ? opt.dataset.inlineText : null;
			// find the human-readable label for this response from the Evaluation row
			const evalRow = sel.closest('.response-row');
			const labelEl = evalRow ? evalRow.querySelector('.response-label') : null;
			const label = labelEl ? labelEl.textContent.trim() : '';
			selected.push({ key: sel.value, inlineText, section, index, label });
		}
	});
	return selected;
}

// old template form removed; editing is handled inline in the editable table

exportTemplatesBtn.addEventListener('click', ()=>{
		const proj = getCurrentProjectName();
		// Prefer structured project JSON if present
		let toExport = null;
		if(projectJsons[proj]) toExport = projectJsons[proj];
		else if(templatesMem[proj] && templatesMem[proj]['__project_json']){
			try{ toExport = JSON.parse(templatesMem[proj]['__project_json']); }catch(e){ toExport = null; }
		}
		if(!toExport){
			// fallback: export in-memory flat map
			toExport = templatesMem[proj] || {};
		}
		const json = JSON.stringify(toExport, null, 2);
		const blob = new Blob([json], {type:'application/json'});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a'); a.href = url; a.download = (proj===DEFAULT_PROJECT_KEY ? 'templates-global.json' : 'templates-'+proj.replace(/\s+/g,'-')+'.json'); document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

clearTemplatesBtn.addEventListener('click', ()=>{
	const proj = getCurrentProjectName();
	if(confirm('Clear all templates for '+(proj===DEFAULT_PROJECT_KEY?'Global':proj)+'?')){
	// clear in-memory templates for the project only; do not touch on-disk Templates/
	templatesMem[proj] = {};
	renderTemplateEditor();
	}
});

// Re-render template editor when selected project changes
const projectLinks = Array.from(sidebar.querySelectorAll('.project-link'));
projectLinks.forEach(l => l.addEventListener('click', ()=> setTimeout(renderTemplateEditor, 50)));

// Also update response selects when project changes
projectLinks.forEach(l => l.addEventListener('click', ()=> setTimeout(populateResponseSelects, 80)));

// When project changes, also apply saved include states for that project after UI updates
projectLinks.forEach(l => l.addEventListener('click', ()=> setTimeout(()=> applySavedIncludeStatesForProject(getCurrentProjectName()), 120)));

// Initial render
loadTemplates();
// restore previously selected project (if any)
loadSelectedProject();
renderTemplateEditor();
populateResponseSelects();

// Attach live-sync handlers to include checkboxes
document.querySelectorAll('.template-includes .include-checkbox').forEach(chk => {
	chk.addEventListener('change', () => applyIncludeStatesToEvalUI());
});

// apply saved include states for current project
applySavedIncludeStatesForProject(getCurrentProjectName());

// Load structured project JSONs from the Templates/ folder (if available)
// Attempt to load structured project JSON files from the Templates/ folder in the repo.
// We build candidate filenames from the sidebar project names and try fetching them.
async function fetchTemplatesFolder(){
	const links = Array.from(sidebar.querySelectorAll('.project-link'));
	const names = links.map(a => a.textContent.trim());
	// include both plain and `template-` prefixed filenames for each project name
	const candidates = [];
	names.forEach(n => {
		const slug = n.replace(/\s+/g,'-');
		candidates.push('Templates/' + slug + '.json');
		candidates.push('Templates/template-' + slug + '.json');
	});
	// Also include known file present in repository as a fallback
	candidates.push('Templates/template-ASICS-(M8).json');

	await Promise.all(candidates.map(async (path) => {
		try{
			const resp = await fetch(path, { cache: 'no-store' });
			if(!resp.ok) return;
			const parsed = await resp.json();
			// determine project mapping: use parsed.name or infer from filename
			let projName = (parsed && parsed.name) ? parsed.name : null;
			if(!projName){
				// try to infer from filename (strip Templates/ and extension)
				const base = path.replace(/^.*\//, '').replace(/\.json$/i, '').replace(/-/g,' ');
				projName = base;
			}
			projectJsons[projName] = parsed;
			templatesMem[projName] = templatesMem[projName] || {};
			// attach inline option text map to templatesMem if provided as flat map
			// if parsed appears to be flat (object with keys mapping to strings) we merge
			if(parsed && !Array.isArray(parsed) && parsed.sections == null){
				Object.keys(parsed).forEach(k => { templatesMem[projName][k] = parsed[k]; });
			}
		}catch(err){ /* ignore fetch/parse errors */ }
	}));
}

// Load a specific project's JSON from the Templates/ folder (if present)
async function loadProjectTemplate(projectName){
	const slug = projectName.replace(/\s+/g,'-');
	const tryFiles = [
		'Templates/' + slug + '.json',
		'Templates/template-' + slug + '.json'
	];
	for(const filename of tryFiles){
		try{
			const resp = await fetch(filename, { cache: 'no-store' });
			if(!resp.ok) continue;
			const parsed = await resp.json();
			// map to project
			projectJsons[projectName] = parsed;
			templatesMem[projectName] = templatesMem[projectName] || {};
			if(parsed && !Array.isArray(parsed) && parsed.sections == null){
				Object.keys(parsed).forEach(k => { templatesMem[projectName][k] = parsed[k]; });
			}
			// stop after successfully loading one file
			return;
		}catch(err){ /* ignore and try next filename */ }
	}
}

// Fetch templates from Templates/ then render UI
fetchTemplatesFolder().finally(()=>{
	// render UI after we attempted to load Templates/ folder
	renderTemplateEditor();
	populateResponseSelects();
	applySavedIncludeStatesForProject(getCurrentProjectName());
	renderSectionsForProject( getCurrentProjectName() );
});

function generateComments(resp){
	// Build a structured feedback message:
	// greeting, introduction, overview, specific feedback lines, conclusion, signoff, evaluator
	const currentProject = getCurrentProjectName();
	const currentTemplates = (templatesMem[currentProject] || templatesMem[DEFAULT_PROJECT_KEY] || {});

	// messages come from the project's JSON only. Do not provide any script-side fallbacks.
	const proj = projectJsons[currentProject] || {};
	const messages = proj.messages || {};
	const greetingText = (messages.greeting && messages.greeting[resp.quality]) ? messages.greeting[resp.quality] : null;
	const greetingLine = greetingText ? (resp.name ? `${greetingText} ${resp.name}.` : `${greetingText}`) : null;
	const introLine = (messages.intro && messages.intro[resp.quality]) ? messages.intro[resp.quality] : null;
	// overview header (per-quality) from JSON only
	const overviewLine = (messages.overview && messages.overview[resp.quality]) ? messages.overview[resp.quality] : null;

	// specific feedback lines derived from selectedKeys
	// Group specifics by section so we can add spacing between collapsible groups
	const specificsBySection = [];
	if(Array.isArray(resp.selectedKeys)){
		// build a map: sectionId -> array of lines
		const map = Object.create(null);
		resp.selectedKeys.forEach(sel => {
			if(!sel) return;
			const sectionId = sel.section || '__misc__';
			const label = sel.label || (sel.key || '').toString();
			let bodyText = null;
			if(sel.inlineText) bodyText = templateReplace(sel.inlineText, resp);
			else if(sel.key){ const val = currentTemplates[sel.key]; if(val) bodyText = templateReplace(val, resp); }
			if(!bodyText) return; // skip entries without actual feedback text
			map[sectionId] = map[sectionId] || [];
			// prefix each detailed feedback line with a bullet for readability
			map[sectionId].push('\u2022 ' + `${label}: ${bodyText}`);
		});

		// Preserve project section ordering when emitting groups
		const projSections = (proj && Array.isArray(proj.sections)) ? proj.sections : [];
		projSections.forEach(sec => {
			const lines = map[sec.id];
			if(lines && lines.length) specificsBySection.push(lines.join('\n'));
			// remove from map to avoid double-emitting
			if(map[sec.id]) delete map[sec.id];
		});
		// any remaining (unknown) sections - emit in insertion order
		Object.keys(map).forEach(k => {
			const lines = map[k];
			if(lines && lines.length) specificsBySection.push(lines.join('\n'));
		});
	}

	// conclusion and signoff
	const conclusionLine = (messages.conclusion && messages.conclusion[resp.quality]) ? messages.conclusion[resp.quality] : null;
	const signoffText = (messages.signoff && messages.signoff[resp.quality]) ? messages.signoff[resp.quality] : null;
	const signoff = signoffText ? (signoffText.endsWith(',') ? signoffText : (signoffText + ',')) : null;

	// assemble final message with spacing — only include parts that exist in JSON/templates
	const sections = [];
	if(greetingLine) sections.push(greetingLine);
	// Show intro and overview together with a single newline between them
	if(introLine && overviewLine){
		sections.push(introLine + '\n' + overviewLine);
	} else {
		if(introLine) sections.push(introLine);
		if(overviewLine) sections.push(overviewLine);
	}
	if(specificsBySection.length) sections.push(specificsBySection.join('\n\n'));
	if(conclusionLine) sections.push(conclusionLine);
	if(signoff) sections.push(signoff);
	// evaluator name is optional; include only if provided in JSON or as a configured value
	const runtimeEvaluator = (window && window.__EVALUATOR_NAME) ? window.__EVALUATOR_NAME : EVALUATOR_NAME;
	if(runtimeEvaluator) sections.push(runtimeEvaluator);

	return sections.join('\n\n');
}

function templateReplace(tmpl, resp){
	// simple placeholder replacement: {name}
	return String(tmpl).replace(/\{\s*name\s*\}/g, resp.name || '');
}

// saved responses UI removed; Template tab holds the template editor

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]); }

evalForm.addEventListener('submit', async (e) => {
	e.preventDefault();
	const data = new FormData(evalForm);
	const resp = {
		name: data.get('name') || '',
		quality: data.get('quality') || '',
		when: Date.now()
	};
	// collect selected response keys from the collapsible sections
	resp.selectedKeys = collectSelectedResponseKeys();
	let output = '';
	try{
		output = generateComments(resp);
	}catch(err){
		console.error('Failed to generate feedback on submit', err);
		const genEl = document.getElementById('evalGenerated');
		if(genEl) genEl.textContent = 'Error generating feedback: ' + (err && err.message ? err.message : String(err));
		return;
	}
	// Copy to clipboard (final output)
	try{
		await navigator.clipboard.writeText(output);
		// update generated feedback area and show toast
		const genEl = document.getElementById('evalGenerated');
		if(genEl) genEl.textContent = output;
		showToast('Feedback copied to clipboard');
	}catch(err){
		console.warn('Clipboard write failed', err);
		const genEl = document.getElementById('evalGenerated');
		if(genEl) genEl.textContent = output + '\n\n(Copy to clipboard failed)';
	}
	// saved responses removed; nothing to render here
	// stay on current tab (do not switch to Responses)
});

// saved responses CSV download/upload removed; Template CSV import still supported below

// toast helper
function showToast(msg, timeout=2000){
	let t = document.querySelector('.toast');
	if(!t){ t = document.createElement('div'); t.className='toast'; document.body.appendChild(t); }
	t.textContent = msg; t.classList.add('show');
	clearTimeout(t._hideId);
	t._hideId = setTimeout(()=> t.classList.remove('show'), timeout);
}

// --- JSON upload for templates ---
// Upload a JSON object mapping key -> template text. Merges into current project's templates.
const templatesJsonUpload = document.getElementById('jsonUpload');
templatesJsonUpload.addEventListener('change', (e) => {
	const file = e.target.files[0];
	if(!file) return;
	const reader = new FileReader();
	reader.onload = () => {
		try{
			const parsed = JSON.parse(reader.result);
			const proj = getCurrentProjectName();
			if(parsed && typeof parsed === 'object'){
				// detect if parsed looks like our structured project JSON (has sections array)
				if(Array.isArray(parsed.sections)){
					importProjectJson(proj, parsed);
					alert('Project JSON imported for project: ' + (proj === DEFAULT_PROJECT_KEY ? 'Global' : proj));
				} else {
					// backwards compatibility: flat map -> merge into in-memory templates
					templatesMem[proj] = templatesMem[proj] || {};
					Object.keys(parsed).forEach(k => { templatesMem[proj][k] = parsed[k]; });
					renderTemplateEditor();
					populateResponseSelects();
					applySavedIncludeStatesForProject(proj);
					alert('Templates (flat JSON) imported into memory for project: ' + (proj === DEFAULT_PROJECT_KEY ? 'Global' : proj));
				}
			} else {
				alert('Uploaded JSON must be an object');
			}
		}catch(err){
			alert('Failed to parse JSON: ' + err.message);
		}
	};
	reader.readAsText(file);
});



	// Live preview: compute output from current form state and render to #evalGenerated
	function updatePreview(){
		const genEl = document.getElementById('evalGenerated');
		if(!genEl) return;
		const name = (document.getElementById('name') || {}).value || '';
		const quality = (document.getElementById('quality') || {}).value || '';
		const resp = { name, quality };
		resp.selectedKeys = collectSelectedResponseKeys();
		try{
			const out = generateComments(resp);
			genEl.textContent = out;
		}catch(err){
			console.error('Failed to generate preview', err);
			genEl.textContent = 'Error generating preview: ' + (err && err.message ? err.message : String(err));
		}
	}

	// Wire live preview updates
	const nameInput = document.getElementById('name');
	const qualitySelect = document.getElementById('quality');
	if(nameInput) nameInput.addEventListener('input', updatePreview);
	if(qualitySelect) qualitySelect.addEventListener('change', updatePreview);
	// update whenever any response-select changes or include checkbox toggles
	document.addEventListener('change', (e)=>{
		if(e.target && (e.target.classList && (e.target.classList.contains('response-select') || e.target.classList.contains('include-checkbox')))){
			updatePreview();
		}
	});

	// initial preview
	updatePreview();

// --- Blanks panel behavior ---
const blanksSelect = document.getElementById('blanksSelect');
const blanksName = document.getElementById('blanksName');
const blanksPreview = document.getElementById('blanksPreview');
const blanksCopy = document.getElementById('blanksCopy');
const BLANKS_KEY = 'eval_blanks_last_choice_v1';

function generateBlankText(choice){
	// Use the user-provided message template. Replace {REASON} with the
	// lowercase version of the dropdown option and {Evaluator} with the
	// runtime evaluator name.
	let lower = String(choice || '').toLowerCase();
	// ensure the phrase contains a leading 'is ' (e.g., 'is corrupted', 'is blank')
	if(lower && !/^is\s+/i.test(lower)){
		lower = 'is ' + lower;
	}
	const runtimeEvaluator = (window && window.__EVALUATOR_NAME) ? window.__EVALUATOR_NAME : EVALUATOR_NAME;
	const studentName = (blanksName && blanksName.value) ? blanksName.value : '{STUDENT}';
	const tpl = `Hi ${studentName},\nUnfortunately I had to give you 0 for this submission because this submission ${lower} and I was unable to view your work. If this was a mistake, please use the HelpHub to request an extension as soon as possible. Extensions are not guaranteed but are more likely to be approved if requested within a few days of receiving this comment. If your extension request is approved, you must resubmit the correct file for it to be evaluated.\nThank you,\n${runtimeEvaluator}`;
	return tpl;
}

function loadBlanksChoice(){
	try{
		const stored = localStorage.getItem(BLANKS_KEY);
		if(stored && blanksSelect) blanksSelect.value = stored;
		if(blanksSelect) blanksSelect.dispatchEvent(new Event('change'));
	}catch(e){}
}

function saveBlanksChoice(val){
	try{ localStorage.setItem(BLANKS_KEY, val); }catch(e){}
}

if(blanksSelect){
	blanksSelect.addEventListener('change', (e)=>{
		const v = e.target.value || '';
		const txt = generateBlankText(v);
		if(blanksPreview) blanksPreview.textContent = txt;
		saveBlanksChoice(v);
	});
}

if(blanksName){
	blanksName.addEventListener('input', ()=>{
		// regenerate preview when name changes
		const v = blanksSelect ? (blanksSelect.value || '') : '';
		if(blanksPreview) blanksPreview.textContent = generateBlankText(v);
	});
}

if(blanksCopy){
	blanksCopy.addEventListener('click', async ()=>{
		if(!blanksPreview) return;
		const text = blanksPreview.textContent || '';
		try{
			await navigator.clipboard.writeText(text);
			showToast('Copied to clipboard');
		}catch(err){
			// no reliable fallback for div text selection in all browsers; attempt a temporary textarea
			try{
				const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); showToast('Copied to clipboard');
			}catch(e){ showToast('Copy failed'); }
		}
	});
}

// load saved blanks choice on startup
loadBlanksChoice();
// ensure preview reflects initial student name if present
if(blanksSelect && blanksPreview){ blanksPreview.textContent = generateBlankText(blanksSelect.value || ''); }

	// Ensure reset clears the currently-selected response options and scrolls to top.
	// We use a microtask delay so the form's native reset (if any) runs first.
	evalForm.addEventListener('reset', (e) => {
		setTimeout(() => {
			// clear all response selects
			document.querySelectorAll('.response-select').forEach(sel => {
				try{ sel.value = ''; sel.selectedIndex = 0; sel.dispatchEvent(new Event('change', { bubbles: true })); }catch(e){}
			});
			// clear generated output
			const genEl = document.getElementById('evalGenerated');
			if(genEl) genEl.textContent = 'No feedback generated yet.';
			// update live preview
			try{ updatePreview(); }catch(e){}
			// scroll to top of page for user
			try{ window.scrollTo && window.scrollTo({ top: 0, behavior: 'smooth' }); }catch(e){ window.scrollTo(0,0); }
		}, 0);
	});

