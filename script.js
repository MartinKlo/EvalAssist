
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
const tabEval = document.getElementById('tab-eval');
const tabTemplate = document.getElementById('tab-template');
const panelEval = document.getElementById('panel-eval');
const panelTemplate = document.getElementById('panel-template');

function activateTab(tab){
	// deactivate all
	[tabEval, tabTemplate].forEach(t => t.setAttribute('aria-selected','false'));
	[panelEval, panelTemplate].forEach(p => p.hidden = true);
	// activate selected
	tab.setAttribute('aria-selected','true');
	const panel = document.getElementById(tab.getAttribute('aria-controls'));
	if(panel) panel.hidden = false;
}

tabEval.addEventListener('click', ()=> activateTab(tabEval));
tabTemplate.addEventListener('click', ()=> activateTab(tabTemplate));

// Form / evaluation store
const evalForm = document.getElementById('evalForm');

// Feedback templates stored in localStorage — map keys to template text
// Example CSV format expected: key,template
// Keys might be 'quality:excellent', 'completeness:partial', 'check:hasReferences', etc.
// legacy: flat templates mapping; new: templatesByProject maps projectName -> { key: template }
let templatesByProject = {};
const TEMPLATES_KEY = 'eval_feedback_templates_v1';
const DEFAULT_PROJECT_KEY = '__global__';
const SELECTED_PROJECT_KEY = 'selected_project_v1';
const INCLUDE_STATE_KEY = 'eval_template_include_state_v1';
const EVALUATOR_NAME = 'Evaluator';

function loadTemplates(){
	try{
		const raw = localStorage.getItem(TEMPLATES_KEY);
		if(!raw) return;
		const parsed = JSON.parse(raw);
		// Migration: if parsed looks like flat mapping (values are strings), convert to default project
		const isFlat = Object.values(parsed).every(v => typeof v === 'string');
		if(isFlat){
			templatesByProject = {};
			templatesByProject[DEFAULT_PROJECT_KEY] = parsed;
		} else {
			// assume already stored as per-project mapping
			templatesByProject = parsed || {};
		}
	}catch(e){ templatesByProject = {}; }
}

function saveTemplates(){
	try{ localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templatesByProject)); }catch(e){}
}

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
const resetDevMemoryBtn = document.getElementById('resetDevMemory');

function renderTemplateEditor(){
	const proj = getCurrentProjectName();
	editorProjectLabel.textContent = proj === DEFAULT_PROJECT_KEY ? 'Global' : proj;
	// No editable table is shown; templates are managed via JSON import/export and will appear in selects
	templatesByProject[proj] = templatesByProject[proj] || {};
}

// Project JSON storage: each project may provide a structured JSON defining sections and responses.
// We'll keep a separate in-memory map projectJsons[projectName] = { name, sections: [ { id, title, responses: [ { id, name, include, options: [keys...] } ] } ] }
const projectJsons = {};

function loadProjectJsonsFromTemplatesMap(){
	// Backwards compatibility: templatesByProject currently stores flat key->template maps.
	// For the new schema we expect JSON uploads to populate projectJsons directly. If a project has no JSON entry,
	// we synthesize a basic structure from available template keys (a single 'general' section with N response slots)
	Object.keys(templatesByProject).forEach(proj => {
		if(!projectJsons[proj]){
			// check if there's a stored JSON in templatesByProject under a special key __project_json
			if(templatesByProject[proj] && templatesByProject[proj]['__project_json']){
				try{
					projectJsons[proj] = JSON.parse(templatesByProject[proj]['__project_json']);
				}catch(e){
					projectJsons[proj] = null;
				}
			}
		}
	});
}

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
		if(sIndex === 0) dEval.open = true;
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
}

// Helper to import a project JSON (strict schema) and store in projectJsons and as special key in templatesByProject for persistence
function importProjectJson(proj, jsonObj){
	// expected shape: { name: "Project Name", sections: [ { id: "s1", title: "Section 1", responses: [ { id: "r1", name: "Response 1", include: true, options: ["key1","key2"] } ] } ] }
	projectJsons[proj] = jsonObj;
	// persist a serialized copy in templatesByProject under reserved key '__project_json' so it survives reloads
	templatesByProject[proj] = templatesByProject[proj] || {};
	templatesByProject[proj]['__project_json'] = JSON.stringify(jsonObj);
	saveTemplates();
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
	const map = templatesByProject[proj] || templatesByProject[DEFAULT_PROJECT_KEY] || {};
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
		else if(templatesByProject[proj] && templatesByProject[proj]['__project_json']){
			try{ toExport = JSON.parse(templatesByProject[proj]['__project_json']); }catch(e){ toExport = null; }
		}
		if(!toExport){
			// fallback: export flat map
			toExport = templatesByProject[proj] || {};
		}
		const json = JSON.stringify(toExport, null, 2);
		const blob = new Blob([json], {type:'application/json'});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a'); a.href = url; a.download = (proj===DEFAULT_PROJECT_KEY ? 'templates-global.json' : 'templates-'+proj.replace(/\s+/g,'-')+'.json'); document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

clearTemplatesBtn.addEventListener('click', ()=>{
	const proj = getCurrentProjectName();
	if(confirm('Clear all templates for '+(proj===DEFAULT_PROJECT_KEY?'Global':proj)+'?')){
		templatesByProject[proj] = {};
		saveTemplates(); renderTemplateEditor();
	}
});

// Developer helper: clear persisted localStorage keys used by the app
if(resetDevMemoryBtn){
	resetDevMemoryBtn.addEventListener('click', ()=>{
		if(!confirm('This will remove stored templates, include states, and selected project from your browser for this app. Continue?')) return;
		try{
			localStorage.removeItem(TEMPLATES_KEY);
			localStorage.removeItem(INCLUDE_STATE_KEY);
			localStorage.removeItem(SELECTED_PROJECT_KEY);
		}catch(e){ console.warn('Failed to clear dev memory', e); }
		// reload so UI reflects cleared state
		location.reload();
	});
}

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

// Load any project JSONs stored in templatesByProject.__project_json
Object.keys(templatesByProject).forEach(proj => {
	try{
		if(templatesByProject[proj] && templatesByProject[proj]['__project_json']){
			projectJsons[proj] = JSON.parse(templatesByProject[proj]['__project_json']);
		}
	}catch(e){ /* ignore parse errors */ }
});
// Render sections for active project
renderSectionsForProject( getCurrentProjectName() );

function generateComments(resp){
	// Build a structured feedback message:
	// greeting, introduction, overview, specific feedback lines, conclusion, signoff, evaluator
	const currentProject = getCurrentProjectName();
	const currentTemplates = (templatesByProject[currentProject] || templatesByProject[DEFAULT_PROJECT_KEY] || {});

	// messages come from the project's JSON only. Do not provide any script-side fallbacks.
	const proj = projectJsons[currentProject] || {};
	const messages = proj.messages || {};
	const greetingText = (messages.greeting && messages.greeting[resp.quality]) ? messages.greeting[resp.quality] : null;
	const greetingLine = greetingText ? (resp.name ? `${greetingText} ${resp.name}.` : `${greetingText}`) : null;
	const introLine = (messages.intro && messages.intro[resp.quality]) ? messages.intro[resp.quality] : null;
	// overview header (per-quality) from JSON only
	const overviewLine = (messages.overview && messages.overview[resp.quality]) ? messages.overview[resp.quality] : null;

	// specific feedback lines derived from selectedKeys
	const specifics = [];
	if(Array.isArray(resp.selectedKeys)){
		resp.selectedKeys.forEach(sel => {
			if(!sel) return;
			// sel may be { key, inlineText, label }
			const label = sel.label || (sel.key || '').toString();
			let bodyText = null;
			// prefer inline text attached to the option (from project JSON or uploaded templates)
			if(sel.inlineText) bodyText = templateReplace(sel.inlineText, resp);
			else if(sel.key){ const val = currentTemplates[sel.key]; if(val) bodyText = templateReplace(val, resp); }
			// Only include specifics when we have actual feedback text from JSON/templates
			if(bodyText) specifics.push(`${label}: ${bodyText}`);
		});
	}

	// conclusion and signoff
	const conclusionLine = (messages.conclusion && messages.conclusion[resp.quality]) ? messages.conclusion[resp.quality] : null;
	const signoffText = (messages.signoff && messages.signoff[resp.quality]) ? messages.signoff[resp.quality] : null;
	const signoff = signoffText ? (signoffText.endsWith(',') ? signoffText : (signoffText + ',')) : null;

	// assemble final message with spacing — only include parts that exist in JSON/templates
	const sections = [];
	if(greetingLine) sections.push(greetingLine);
	if(introLine) sections.push(introLine);
	if(overviewLine) sections.push(overviewLine);
	if(specifics.length) sections.push(specifics.join('\n'));
	if(conclusionLine) sections.push(conclusionLine);
	if(signoff) sections.push(signoff);
	// evaluator name is optional; include only if provided in JSON or as a configured constant
	if(EVALUATOR_NAME) sections.push(EVALUATOR_NAME);

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
					// backwards compatibility: flat map -> merge into templatesByProject
					templatesByProject[proj] = templatesByProject[proj] || {};
					Object.keys(parsed).forEach(k => { templatesByProject[proj][k] = parsed[k]; });
					saveTemplates();
					renderTemplateEditor();
					populateResponseSelects();
					applySavedIncludeStatesForProject(proj);
					alert('Templates (flat JSON) imported and saved to localStorage for project: ' + (proj === DEFAULT_PROJECT_KEY ? 'Global' : proj));
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

