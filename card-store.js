// card-store.js — shared image store across card tools
// Images are kept in memory (sessionStorage keys hold metadata, blobs held in module)

const CardStore = (() => {
    const KEY = 'megahub-cards';
    let _blobs = {}; // id -> object URL (in-memory, lost on page close)

    function _getMeta() {
        try { return JSON.parse(sessionStorage.getItem(KEY)) || []; }
        catch { return []; }
    }

    function _saveMeta(cards) {
        sessionStorage.setItem(KEY, JSON.stringify(cards.map(c => ({ id: c.id, name: c.name, weight: c.weight }))));
    }

    // Restore blob URLs from sessionStorage on page load — NOT possible cross-page,
    // so we store files in IndexedDB for cross-page persistence.
    // For simplicity: store as base64 in sessionStorage.

    function getAll() {
        try {
            const raw = JSON.parse(sessionStorage.getItem(KEY)) || [];
            return raw;
        } catch { return []; }
    }

    async function addFiles(fileList) {
        const existing = getAll();
        const existingNames = new Set(existing.map(c => c.name));
        const newCards = [];

        for (const file of fileList) {
            if (!file.type.startsWith('image/')) continue;
            if (existingNames.has(file.name)) continue;

            const base64 = await toBase64(file);
            const match = file.name.match(/^(.+)-(\d+(?:\.\d+)?)%\..+$/);
            const name   = match ? match[1].trim() : file.name.replace(/\.[^.]+$/, '');
            const weight = match ? parseFloat(match[2]) : null;

            newCards.push({ id: crypto.randomUUID(), name, weight, base64 });
        }

        const all = [...existing, ...newCards];
        try {
            sessionStorage.setItem(KEY, JSON.stringify(all));
        } catch (e) {
            // sessionStorage quota — trim oldest if needed
            console.warn('SessionStorage full, trimming:', e);
        }
        return all;
    }

    function remove(id) {
        const all = getAll().filter(c => c.id !== id);
        sessionStorage.setItem(KEY, JSON.stringify(all));
        return all;
    }

    function clear() {
        sessionStorage.removeItem(KEY);
        return [];
    }

    function toBase64(file) {
        return new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.onerror = rej;
            r.readAsDataURL(file);
        });
    }

    return { getAll, addFiles, remove, clear };
})();
