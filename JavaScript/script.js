/* =====================================================
   GESTÃO COMERCIAL
   Módulo de produtos: CRUD, pesquisa, filtros e tabela
   Os dados desta versão são salvos no localStorage.
===================================================== */

"use strict";

const STORAGE_KEY = "gestao.comercial.products.v2";
const PAGE_SIZE = 8;

// Auditoria local + sincronização com o backend Python quando aberto por localhost.
const AUDIT_STORAGE_KEY = "gestao.comercial.audit.v1";
function auditLog(action, details = {}) {
    const entry = { id: makeId(), action, details, createdAt: new Date().toISOString() };
    try {
        const history = JSON.parse(localStorage.getItem(AUDIT_STORAGE_KEY) || "[]");
        history.push(entry);
        localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(history.slice(-3000)));
    } catch (error) { console.warn("Não foi possível gravar log local:", error); }
    if (location.protocol === "http:" || location.protocol === "https:") {
        fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) }).catch(() => {});
    }
    if (document.querySelector("#view-logs") && !$("#view-logs").hidden) {
        auditEntries = [normalizeAuditEntry(entry), ...auditEntries.filter((item) => item.id !== entry.id)];
        renderAuditLogs();
    }
}
function syncSnapshotToPython() {
    if (!(location.protocol === "http:" || location.protocol === "https:")) return;
    const snapshot = {
        products: JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"),
        sales: JSON.parse(localStorage.getItem(SALES_STORAGE_KEY) || "[]"),
        contacts: JSON.parse(localStorage.getItem(CONTACTS_STORAGE_KEY) || "[]")
    };
    fetch("/api/snapshot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot) })
        .then(response => { if (!response.ok) throw new Error("Falha ao sincronizar banco"); })
        .catch(error => console.warn("Banco Python indisponível; os dados continuam no navegador:", error));
}

const CATEGORIES = {
    uncategorized: { label: "Sem categoria", tag: "tag-uncategorized", subcategories: [] },
    food: { label: "Mercearia", tag: "tag-food", subcategories: [
        ["dry-goods", "Grãos e básicos"], ["canned", "Enlatados e conservas"], ["pasta", "Massas e molhos"], ["breakfast", "Café da manhã"], ["seasoning", "Temperos e complementos"]
    ] },
    produce: { label: "Hortifruti", tag: "tag-produce", subcategories: [
        ["fruits", "Frutas"], ["vegetables", "Verduras e legumes"]
    ] },
    dairy: { label: "Frios e laticínios", tag: "tag-dairy", subcategories: [
        ["milk", "Leites e bebidas lácteas"], ["cheese", "Queijos e frios"], ["yogurt", "Iogurtes e sobremesas"]
    ] },
    bakery: { label: "Padaria", tag: "tag-bakery", subcategories: [
        ["bread", "Pães"], ["cakes", "Bolos e biscoitos de padaria"]
    ] },
    beverages: { label: "Bebidas", tag: "tag-beverages", subcategories: [
        ["water", "Água"], ["soft-drinks", "Refrigerantes"], ["juices", "Sucos e néctares"]
    ] },
    frozen: { label: "Congelados", tag: "tag-frozen", subcategories: [
        ["frozen-food", "Alimentos congelados"], ["ice-cream", "Sorvetes e picolés"]
    ] },
    cleaning: { label: "Limpeza", tag: "tag-cleaning", subcategories: [
        ["house-cleaning", "Limpeza doméstica"], ["laundry", "Lavanderia"], ["dish", "Louças e cozinha"]
    ] },
    personal: { label: "Higiene pessoal", tag: "tag-personal", subcategories: [
        ["bath", "Banho e higiene"], ["oral-care", "Higiene bucal"]
    ] },
    household: { label: "Utilidades", tag: "tag-household", subcategories: [
        ["kitchen", "Casa e cozinha"], ["disposables", "Descartáveis"]
    ] }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const elements = {
    search: $("#product-search"),
    categoryFilter: $("#category-filter"),
    subcategoryFilter: $("#subcategory-filter"),
    tableBody: $("#products-table-body"),
    productCount: $("#product-count"),
    listSummary: $("#list-summary"),
    tableStatus: $("#table-status"),
    previousPage: $("#previous-page"),
    nextPage: $("#next-page"),
    pageIndicator: $("#page-indicator"),
    modal: $("#product-modal"),
    form: $("#product-form"),
    modalTitle: $("#modal-title"),
    productId: $("#product-id"),
    name: $("#product-name"),
    code: $("#product-code"),
    reference: $("#product-reference"),
    barcode: $("#product-barcode"),
    manufacturerCode: $("#product-factory-code"),
    category: $("#product-category"),
    subcategory: $("#product-subcategory"),
    brand: $("#product-brand"),
    unit: $("#product-unit"),
    areaPerUnit: $("#product-area-per-unit"),
    areaUnitLabel: $("#product-area-unit-label"),
    areaPerUnitField: $("#area-per-unit-field"),
    priceCashLabel: $("#product-price-cash-label"),
    priceCardLabel: $("#product-price-card-label"),
    stock: $("#product-stock"),
    priceCash: $("#product-price-cash"),
    priceCard: $("#product-price-card"),
    details: $("#product-details"),
    toastContainer: $("#toast-container"),
    columnPanel: $("#column-panel"),
    customizeColumnsButton: $("#customize-columns-button")
};

let products = loadProducts();
let currentPage = 1;
let activeActionMenu = null;

function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }
    return `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function demoProducts() {
    // Catálogo fictício para demonstração: valores ilustrativos, editáveis no cadastro.
    return [
        { id: makeId(), code: "MER-001", name: "Arroz tipo 1 · 5 kg", category: "food", subcategory: "dry-goods", brand: "", unit: "Pacote", stock: 28, priceCash: 26.90, priceCard: 28.90, details: "Pacote de arroz branco tipo 1. Preço ilustrativo." },
        { id: makeId(), code: "MER-002", name: "Feijão carioca · 1 kg", category: "food", subcategory: "dry-goods", brand: "", unit: "Pacote", stock: 34, priceCash: 7.49, priceCard: 7.79, details: "Pacote de feijão carioca. Preço ilustrativo." },
        { id: makeId(), code: "MER-003", name: "Açúcar refinado · 1 kg", category: "food", subcategory: "dry-goods", brand: "", unit: "Pacote", stock: 26, priceCash: 4.49, priceCard: 4.69, details: "Pacote de açúcar refinado. Preço ilustrativo." },
        { id: makeId(), code: "MER-004", name: "Óleo de soja · 900 ml", category: "food", subcategory: "dry-goods", brand: "", unit: "Garrafa", stock: 42, priceCash: 7.49, priceCard: 7.79, details: "Garrafa de óleo de soja. Preço ilustrativo." },
        { id: makeId(), code: "MER-005", name: "Macarrão espaguete · 500 g", category: "food", subcategory: "pasta", brand: "", unit: "Pacote", stock: 38, priceCash: 4.29, priceCard: 4.49, details: "Massa seca tipo espaguete. Preço ilustrativo." },
        { id: makeId(), code: "MER-006", name: "Molho de tomate · 300 g", category: "food", subcategory: "pasta", brand: "", unit: "Sachê", stock: 31, priceCash: 2.49, priceCard: 2.69, details: "Molho tradicional de tomate. Preço ilustrativo." },
        { id: makeId(), code: "MER-007", name: "Café torrado e moído · 500 g", category: "food", subcategory: "breakfast", brand: "", unit: "Pacote", stock: 19, priceCash: 24.90, priceCard: 26.50, details: "Pacote de café tradicional. Preço ilustrativo." },
        { id: makeId(), code: "MER-008", name: "Farinha de trigo · 1 kg", category: "food", subcategory: "dry-goods", brand: "", unit: "Pacote", stock: 22, priceCash: 5.49, priceCard: 5.69, details: "Farinha de trigo tradicional. Preço ilustrativo." },
        { id: makeId(), code: "MER-009", name: "Milho-verde · 170 g", category: "food", subcategory: "canned", brand: "", unit: "Lata", stock: 16, priceCash: 3.99, priceCard: 4.19, details: "Lata de milho-verde. Preço ilustrativo." },
        { id: makeId(), code: "MER-010", name: "Biscoito cream cracker · 350 g", category: "food", subcategory: "breakfast", brand: "", unit: "Pacote", stock: 24, priceCash: 5.49, priceCard: 5.79, details: "Pacote de biscoito salgado. Preço ilustrativo." },
        { id: makeId(), code: "HORT-001", name: "Banana-prata", category: "produce", subcategory: "fruits", brand: "", unit: "Quilo", stock: 35, priceCash: 6.99, priceCard: 7.29, details: "Venda por quilo. Preço ilustrativo." },
        { id: makeId(), code: "HORT-002", name: "Tomate", category: "produce", subcategory: "vegetables", brand: "", unit: "Quilo", stock: 24, priceCash: 7.99, priceCard: 8.29, details: "Venda por quilo. Preço ilustrativo." },
        { id: makeId(), code: "HORT-003", name: "Batata inglesa", category: "produce", subcategory: "vegetables", brand: "", unit: "Quilo", stock: 32, priceCash: 6.49, priceCard: 6.79, details: "Venda por quilo. Preço ilustrativo." },
        { id: makeId(), code: "HORT-004", name: "Maçã nacional", category: "produce", subcategory: "fruits", brand: "", unit: "Quilo", stock: 18, priceCash: 9.90, priceCard: 10.30, details: "Venda por quilo. Preço ilustrativo." },
        { id: makeId(), code: "LAT-001", name: "Leite integral · 1 L", category: "dairy", subcategory: "milk", brand: "", unit: "Caixa", stock: 48, priceCash: 5.49, priceCard: 5.69, details: "Leite integral UHT. Preço ilustrativo." },
        { id: makeId(), code: "LAT-002", name: "Iogurte natural · 170 g", category: "dairy", subcategory: "yogurt", brand: "", unit: "Unidade", stock: 20, priceCash: 2.49, priceCard: 2.69, details: "Pote individual. Preço ilustrativo." },
        { id: makeId(), code: "LAT-003", name: "Queijo mussarela", category: "dairy", subcategory: "cheese", brand: "", unit: "Quilo", stock: 8, priceCash: 39.90, priceCard: 41.50, details: "Venda por quilo. Preço ilustrativo." },
        { id: makeId(), code: "PAD-001", name: "Pão de forma · 450 g", category: "bakery", subcategory: "bread", brand: "", unit: "Pacote", stock: 14, priceCash: 8.99, priceCard: 9.29, details: "Pacote de pão de forma. Preço ilustrativo." },
        { id: makeId(), code: "PAD-002", name: "Pão francês", category: "bakery", subcategory: "bread", brand: "", unit: "Quilo", stock: 10, priceCash: 14.90, priceCard: 15.50, details: "Venda por quilo. Preço ilustrativo." },
        { id: makeId(), code: "BEB-001", name: "Refrigerante cola · 2 L", category: "beverages", subcategory: "soft-drinks", brand: "", unit: "Garrafa", stock: 25, priceCash: 9.49, priceCard: 9.89, details: "Garrafa de 2 litros. Preço ilustrativo." },
        { id: makeId(), code: "BEB-002", name: "Água mineral · 1,5 L", category: "beverages", subcategory: "water", brand: "", unit: "Garrafa", stock: 40, priceCash: 3.49, priceCard: 3.69, details: "Garrafa sem gás. Preço ilustrativo." },
        { id: makeId(), code: "BEB-003", name: "Néctar de uva · 1 L", category: "beverages", subcategory: "juices", brand: "", unit: "Caixa", stock: 18, priceCash: 6.49, priceCard: 6.79, details: "Bebida à base de fruta. Preço ilustrativo." },
        { id: makeId(), code: "LIM-001", name: "Detergente neutro · 500 ml", category: "cleaning", subcategory: "dish", brand: "", unit: "Unidade", stock: 36, priceCash: 2.49, priceCard: 2.69, details: "Detergente líquido para louças. Preço ilustrativo." },
        { id: makeId(), code: "LIM-002", name: "Sabão em pó · 1,6 kg", category: "cleaning", subcategory: "laundry", brand: "", unit: "Pacote", stock: 13, priceCash: 18.90, priceCard: 19.70, details: "Sabão em pó para roupas. Preço ilustrativo." },
        { id: makeId(), code: "HIG-001", name: "Papel higiênico · 12 rolos", category: "personal", subcategory: "bath", brand: "", unit: "Pacote", stock: 15, priceCash: 16.90, priceCard: 17.60, details: "Pacote com 12 rolos. Preço ilustrativo." },
        { id: makeId(), code: "HIG-002", name: "Creme dental · 90 g", category: "personal", subcategory: "oral-care", brand: "", unit: "Unidade", stock: 27, priceCash: 4.99, priceCard: 5.19, details: "Creme dental de uso diário. Preço ilustrativo." },
        { id: makeId(), code: "CONG-001", name: "Batata pré-frita congelada · 400 g", category: "frozen", subcategory: "frozen-food", brand: "", unit: "Pacote", stock: 9, priceCash: 12.90, priceCard: 13.50, details: "Pacote congelado. Preço ilustrativo." },
        { id: makeId(), code: "CONG-002", name: "Picolé de fruta", category: "frozen", subcategory: "ice-cream", brand: "", unit: "Unidade", stock: 30, priceCash: 3.50, priceCard: 3.69, details: "Unidade avulsa. Preço ilustrativo." },
        { id: makeId(), code: "UTIL-001", name: "Saco para lixo · 30 L", category: "household", subcategory: "disposables", brand: "", unit: "Pacote", stock: 18, priceCash: 5.99, priceCard: 6.29, details: "Pacote com sacos para lixo. Preço ilustrativo." }
    ];
}

function loadProducts() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (error) {
        console.error("Não foi possível ler os produtos salvos:", error);
    }
    const samples = demoProducts();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(samples)); }
    catch (error) { console.warn("O navegador não permitiu salvar os dados locais.", error); }
    return samples;
}

function persistProducts() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
        auditLog("products_saved", { count: products.length });
        syncSnapshotToPython();
        return true;
    } catch (error) {
        console.error("Erro ao salvar os produtos:", error);
        showToast("Não foi possível salvar os dados neste navegador.", "error");
        return false;
    }
}

function normalizeText(value) {
    return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function formatCurrency(value) {
    if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return "—";
    return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatStock(value) {
    if (value === null || value === undefined || value === "") return "—";
    return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function categoryLabel(key) {
    return CATEGORIES[key]?.label || CATEGORIES.uncategorized.label;
}

function subcategoryLabel(category, subcategory) {
    const item = CATEGORIES[category]?.subcategories.find(([key]) => key === subcategory);
    return item ? item[1] : "Sem subcategoria";
}

function productVariation(product) {
    return product.details || product.brand || subcategoryLabel(product.category, product.subcategory) || "—";
}

function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast${type === "error" ? " error" : ""}`;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3400);
}

function updateFilterSubcategories() {
    const selectedCategory = elements.categoryFilter.value;
    const currentValue = elements.subcategoryFilter.value;
    const options = [{ value: "all", label: "Todas as subcategorias" }];

    Object.entries(CATEGORIES).forEach(([categoryKey, category]) => {
        if (selectedCategory !== "all" && selectedCategory !== categoryKey) return;
        category.subcategories.forEach(([subKey, label]) => {
            options.push({ value: `${categoryKey}|${subKey}`, label: selectedCategory === "all" ? `${label} — ${category.label}` : label });
        });
    });

    elements.subcategoryFilter.innerHTML = options.map((option) =>
        `<option value="${escapeHTML(option.value)}">${escapeHTML(option.label)}</option>`
    ).join("");

    if (options.some((option) => option.value === currentValue)) elements.subcategoryFilter.value = currentValue;
    else elements.subcategoryFilter.value = "all";
}

function getFilteredProducts() {
    const query = normalizeText(elements.search.value);
    const category = elements.categoryFilter.value;
    const subcategory = elements.subcategoryFilter.value;

    return products.filter((product) => {
        const searchable = normalizeText([
            product.name, product.code, product.reference, product.barcode, product.manufacturerCode, product.brand, product.details,
            categoryLabel(product.category), subcategoryLabel(product.category, product.subcategory),
            productVariation(product)
        ].filter(Boolean).join(" "));

        const matchesQuery = !query || searchable.includes(query);
        const matchesCategory = category === "all" || product.category === category;
        let matchesSubcategory = true;
        if (subcategory !== "all") {
            const [filterCategory, filterSubcategory] = subcategory.split("|");
            matchesSubcategory = product.category === filterCategory && product.subcategory === filterSubcategory;
        }
        return matchesQuery && matchesCategory && matchesSubcategory;
    });
}

function renderProducts() {
    const filtered = getFilteredProducts();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageProducts = filtered.slice(start, start + PAGE_SIZE);

    elements.productCount.textContent = `(${filtered.length})`;
    elements.listSummary.textContent = `${filtered.length} ${filtered.length === 1 ? "produto encontrado" : "produtos encontrados"}`;
    elements.tableStatus.textContent = filtered.length
        ? `Exibindo ${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} de ${filtered.length} produtos.`
        : "Nenhum produto corresponde aos filtros selecionados.";
    elements.pageIndicator.textContent = String(currentPage);
    elements.previousPage.disabled = currentPage <= 1;
    elements.nextPage.disabled = currentPage >= totalPages;

    if (pageProducts.length === 0) {
        elements.tableBody.innerHTML = `<tr><td colspan="8" class="empty-message">Nenhum produto encontrado. Experimente alterar a pesquisa ou os filtros.</td></tr>`;
        applyColumnVisibility();
        return;
    }

    elements.tableBody.innerHTML = pageProducts.map((product) => {
        const category = CATEGORIES[product.category] || CATEGORIES.uncategorized;
        const subtitle = subcategoryLabel(product.category, product.subcategory);
        return `
            <tr data-product-id="${escapeHTML(product.id)}">
                <td data-column="product"><div class="product-info"><strong>${escapeHTML(product.name)}</strong><span>${escapeHTML(product.code || "Sem código")}${product.reference ? ` · Ref. ${escapeHTML(product.reference)}` : ""} · ${escapeHTML(subtitle)}</span></div></td>
                <td data-column="category"><span class="category-tag ${category.tag}">${escapeHTML(category.label)}</span></td>
                <td data-column="subcategory"><span class="variation-info">${escapeHTML(productVariation(product))}</span></td>
                <td data-column="unit">${escapeHTML(product.unit || "—")}</td>
                <td data-column="stock">${escapeHTML(formatStock(product.stock))}</td>
                <td data-column="cash"><strong>${escapeHTML(formatCurrency(product.priceCash))}</strong><small class="unit-price-detail">${escapeHTML(priceUnitLabel(product))}</small></td>
                <td data-column="card"><strong>${escapeHTML(formatCurrency(product.priceCard))}</strong><small class="unit-price-detail">${escapeHTML(priceUnitLabel(product))}</small></td>
                <td data-column="actions"><div class="row-actions">
                    <button class="action-button" type="button" data-action="edit" data-id="${escapeHTML(product.id)}" title="Editar" aria-label="Editar ${escapeHTML(product.name)}">✎</button>
                    <div class="action-menu-wrap">
                        <button class="action-button" type="button" data-action="menu" data-id="${escapeHTML(product.id)}" title="Mais ações" aria-label="Mais ações para ${escapeHTML(product.name)}" aria-expanded="false">⋯</button>
                        <div class="action-menu" data-menu-for="${escapeHTML(product.id)}" hidden>
                            <button type="button" data-action="duplicate" data-id="${escapeHTML(product.id)}">Duplicar produto</button>
                            <button type="button" class="danger" data-action="delete" data-id="${escapeHTML(product.id)}">Excluir produto</button>
                        </div>
                    </div>
                </div></td>
            </tr>`;
    }).join("");
    applyColumnVisibility();
}

function applyColumnVisibility() {
    $$('[data-column-toggle]').forEach((checkbox) => {
        const column = checkbox.dataset.columnToggle;
        $$(`[data-column="${column}"]`).forEach((cell) => { cell.hidden = !checkbox.checked; });
    });
}

function populateSubcategorySelect(selectedValue = "") {
    const options = CATEGORIES[elements.category.value]?.subcategories || [];
    elements.subcategory.innerHTML = '<option value="">Selecione uma subcategoria</option>' + options.map(([key, label]) =>
        `<option value="${escapeHTML(key)}">${escapeHTML(label)}</option>`
    ).join("");
    if (options.some(([key]) => key === selectedValue)) elements.subcategory.value = selectedValue;
}

function updateProductUnitFields() {
    const unit = elements.unit.value;
    const isArea = unit === "Metro quadrado";
    elements.areaPerUnitField.hidden = !isArea;
    const suffix = unit === "Metro linear" || unit === "Metro" ? "por metro linear" : isArea ? "por m²" : `por ${unit.toLowerCase()}`;
    elements.priceCashLabel.textContent = `Preço à vista · ${suffix}`;
    elements.priceCardLabel.textContent = `Preço normal (cartão) · ${suffix}`;
}

function clearForm() {
    elements.form.reset();
    elements.productId.value = "";
    elements.category.value = "uncategorized";
    elements.unit.value = "Peça";
    elements.areaPerUnit.value = "";
    elements.areaUnitLabel.value = "";
    populateSubcategorySelect();
    updateProductUnitFields();
}

function openProductModal(product = null) {
    clearForm();
    if (product) {
        elements.modalTitle.textContent = "Editar produto";
        elements.productId.value = product.id;
        elements.name.value = product.name || "";
        elements.code.value = product.code || "";
        elements.reference.value = product.reference || "";
        elements.barcode.value = product.barcode || "";
        elements.manufacturerCode.value = product.manufacturerCode || "";
        elements.category.value = product.category || "uncategorized";
        populateSubcategorySelect(product.subcategory || "");
        elements.brand.value = product.brand || "";
        elements.unit.value = product.unit || "Unidade";
        elements.areaPerUnit.value = product.areaPerUnit ?? "";
        elements.areaUnitLabel.value = product.areaUnitLabel || "Tela";
        elements.stock.value = product.stock ?? "";
        elements.priceCash.value = product.priceCash ?? "";
        elements.priceCard.value = product.priceCard ?? "";
        elements.details.value = product.details || "";
        updateProductUnitFields();
    } else {
        elements.modalTitle.textContent = "Novo produto";
    }
    elements.modal.hidden = false;
    document.body.classList.add("modal-open");
    window.setTimeout(() => elements.name.focus(), 30);
}

function closeProductModal() {
    elements.modal.hidden = true;
    document.body.classList.remove("modal-open");
    clearForm();
}

function readOptionalNumber(input) {
    if (input.value.trim() === "") return null;
    const number = Number(input.value);
    return Number.isFinite(number) && number >= 0 ? number : null;
}

function generateCode() {
    let code;
    do { code = `PRD-${String(Date.now()).slice(-7)}`; }
    while (products.some((product) => product.code === code));
    return code;
}

function handleProductSubmit(event) {
    event.preventDefault();
    if (!elements.form.reportValidity()) return;

    const id = elements.productId.value || makeId();
    const category = elements.category.value;
    const existing = products.find((product) => product.id === id);
    let code = elements.code.value.trim();
    if (!code) code = existing?.code || generateCode();

    const duplicateCode = products.some((product) => product.code && product.code.toLowerCase() === code.toLowerCase() && product.id !== id);
    if (duplicateCode) {
        showToast("Esse código já está sendo utilizado por outro produto.", "error");
        elements.code.focus();
        return;
    }

    const product = {
        id,
        code,
        reference: elements.reference.value.trim(),
        barcode: elements.barcode.value.trim(),
        manufacturerCode: elements.manufacturerCode.value.trim(),
        name: elements.name.value.trim(),
        category,
        subcategory: elements.subcategory.value,
        brand: elements.brand.value.trim(),
        unit: elements.unit.value,
        areaPerUnit: elements.unit.value === "Metro quadrado" ? readOptionalNumber(elements.areaPerUnit) : null,
        areaUnitLabel: elements.unit.value === "Metro quadrado" && readOptionalNumber(elements.areaPerUnit) ? (elements.areaUnitLabel.value.trim() || "Unidade") : "",
        stock: readOptionalNumber(elements.stock),
        priceCash: readOptionalNumber(elements.priceCash) ?? 0,
        priceCard: readOptionalNumber(elements.priceCard) ?? 0,
        details: elements.details.value.trim()
    };

    const previousProducts = [...products];
    if (existing) {
        products = products.map((item) => item.id === id ? product : item);
    } else {
        products.unshift(product);
        currentPage = 1;
    }

    if (!persistProducts()) {
        products = previousProducts;
        return;
    }
    auditLog(existing ? "product_updated" : "product_created", { productId: id, code, productName: product.name });
    renderProducts();
    closeProductModal();
    showToast(existing ? "Produto atualizado com sucesso." : "Produto cadastrado com sucesso.");
}

function editProduct(id) {
    const product = products.find((item) => item.id === id);
    if (product) openProductModal(product);
}

function deleteProduct(id) {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    const confirmed = window.confirm(`Deseja realmente excluir o produto "${product.name}"?`);
    if (!confirmed) return;
    const originalIndex = products.findIndex((item) => item.id === id);
    products = products.filter((item) => item.id !== id);
    if (!persistProducts()) {
        products.splice(Math.max(originalIndex, 0), 0, product);
        return;
    }
    auditLog("product_deleted", { productId: id, code: product.code || "", productName: product.name });
    closeActionMenus();
    renderProducts();
    showToast("Produto excluído.");
}

function duplicateProduct(id) {
    const original = products.find((item) => item.id === id);
    if (!original) return;
    const copy = structuredCloneSafe(original);
    copy.id = makeId();
    copy.code = generateCode();
    copy.name = `${original.name} (cópia)`;
    products.unshift(copy);
    currentPage = 1;
    if (!persistProducts()) {
        products = products.filter((item) => item.id !== copy.id);
        return;
    }
    auditLog("product_duplicated", { originalProductId: original.id, productId: copy.id, code: copy.code, productName: copy.name });
    closeActionMenus();
    renderProducts();
    showToast("Cópia criada. Edite os dados para ajustar a nova variação.");
}

function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
}

function closeActionMenus() {
    $$(".action-menu").forEach((menu) => { menu.hidden = true; });
    $$('[data-action="menu"]').forEach((button) => button.setAttribute("aria-expanded", "false"));
    activeActionMenu = null;
}

function toggleActionMenu(id, button) {
    const menu = $(`[data-menu-for="${CSS.escape(id)}"]`);
    if (!menu) return;
    const isOpen = !menu.hidden;
    closeActionMenus();
    if (!isOpen) {
        menu.hidden = false;
        button.setAttribute("aria-expanded", "true");
        activeActionMenu = id;
    }
}

function toggleColumnPanel(forceOpen) {
    const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : elements.columnPanel.hidden;
    elements.columnPanel.hidden = !shouldOpen;
    elements.customizeColumnsButton.setAttribute("aria-expanded", String(shouldOpen));
}

function handleTableClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === "edit") editProduct(id);
    if (action === "menu") toggleActionMenu(id, button);
    if (action === "delete") deleteProduct(id);
    if (action === "duplicate") duplicateProduct(id);
}

/* =====================================================
   V3 — FLUXO DE VENDAS, DOCUMENTOS E ENTREGAS
   As vendas são finalizadas primeiro; a impressão é posterior,
   em uma tela separada, pesquisando o número da venda.
===================================================== */

const SALES_STORAGE_KEY = "gestao.comercial.sales.v1";
const CONTACTS_STORAGE_KEY = "gestao.comercial.deliveryContacts.v1";
const BUSINESS_NAME_KEY = "gestao.comercial.businessName.v2";
const BUSINESS_SETTINGS_KEY = "gestao.comercial.businessSettings.v2";
let sales = loadStoredArray(SALES_STORAGE_KEY);
let deliveryContacts = loadStoredArray(CONTACTS_STORAGE_KEY);
let currentSaleItems = [];
let selectedSaleProductId = null;
let selectedSaleIdForDelivery = null;
let pendingPrintCleanup = false;
let auditEntries = [];

const AUDIT_ACTION_LABELS = {
    application_opened: "Abertura do sistema",
    backend_started: "Servidor Python iniciado",
    products_saved: "Catálogo de produtos salvo",
    product_created: "Produto cadastrado",
    product_updated: "Produto alterado",
    product_deleted: "Produto excluído",
    product_duplicated: "Produto duplicado",
    sale_item_added: "Item adicionado à venda",
    sale_item_removed: "Item removido da venda",
    sale_item_quantity_changed: "Quantidade do item alterada",
    sale_item_length_changed: "Comprimento do item alterado",
    sale_draft_cleared: "Lista de venda limpa",
    sales_saved: "Vendas salvas",
    sale_finalized: "Venda finalizada",
    delivery_contacts_saved: "Destinatários salvos",
    delivery_contact_saved: "Destinatário salvo para reutilização",
    delivery_created: "Entrega cadastrada",
    delivery_updated: "Dados da entrega alterados",
    delivery_status_changed: "Situação da entrega alterada",
    document_print_requested: "Impressão solicitada",
    settings_updated: "Configurações alteradas",
    database_snapshot_synced: "Cópia sincronizada com SQLite"
};

function normalizeAuditEntry(entry) {
    let details = entry.details || {};
    if (typeof entry.details_json === "string") {
        try { details = JSON.parse(entry.details_json); } catch { details = {}; }
    }
    return {
        id: entry.id || makeId(),
        action: entry.action || "unknown",
        details,
        createdAt: entry.createdAt || entry.created_at || new Date().toISOString(),
        source: entry.source || "navegador"
    };
}

function localDateKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function auditDetailsLabel(entry) {
    const d = entry.details || {};
    const parts = [];
    if (d.saleNumber) parts.push(`Venda ${d.saleNumber}`);
    if (d.productName) parts.push(d.productName);
    else if (d.code) parts.push(`Código ${d.code}`);
    if (d.total !== undefined) parts.push(`Total ${formatCurrency(d.total)}`);
    if (d.itemLines !== undefined) parts.push(`${d.itemLines} linha(s)`);
    if (d.quantity !== undefined) parts.push(`Quantidade ${formatStock(d.quantity)}`);
    if (d.lengthEach !== undefined && d.measureMode !== "linear") parts.push(`Medida ${formatMeasure(d.lengthEach)} m`);
    if (d.documentType) parts.push(d.documentType === "customer" ? "Via do cliente" : "Via de entrega");
    if (d.newStatus) parts.push(`Status: ${deliveryStatusLabel(d.newStatus)}`);
    if (d.count !== undefined) parts.push(`${d.count} registro(s)`);
    if (d.fieldsUpdated !== undefined) parts.push(`${d.fieldsUpdated} campo(s) preenchido(s)`);
    if (d.removedItemLines !== undefined) parts.push(`${d.removedItemLines} linha(s) removida(s)`);
    if (d.measureMode === "linear" && d.lengthEach) parts.push(`${formatMeasure(d.lengthEach)} m por unidade`);
    return parts.join(" · ") || "Ação registrada";
}

function renderAuditLogs() {
    const body = $("#logs-table-body");
    if (!body) return;
    const query = normalizeText($("#logs-search").value);
    const action = $("#logs-action-filter").value;
    const date = $("#logs-date-filter").value;
    const matches = auditEntries.filter((entry) => {
        const actionLabel = AUDIT_ACTION_LABELS[entry.action] || entry.action;
        const searchable = normalizeText(`${actionLabel} ${entry.action} ${auditDetailsLabel(entry)} ${entry.source}`);
        return (action === "all" || entry.action === action) && (!date || localDateKey(entry.createdAt) === date) && (!query || searchable.includes(query));
    });
    $("#logs-count").textContent = `${matches.length} ${matches.length === 1 ? "registro" : "registros"}`;
    $("#logs-empty").hidden = matches.length > 0;
    $(".logs-table-wrap").hidden = matches.length === 0;
    body.innerHTML = matches.slice(0, 500).map((entry) => `
        <tr><td>${escapeHTML(formatDateTime(entry.createdAt))}</td>
        <td><strong>${escapeHTML(AUDIT_ACTION_LABELS[entry.action] || entry.action)}</strong><small>${escapeHTML(entry.action)}</small></td>
        <td>${escapeHTML(auditDetailsLabel(entry))}</td>
        <td><span class="log-source">${escapeHTML(entry.source === "system" ? "Python" : entry.source === "application" ? "SQLite" : "Navegador")}</span></td></tr>
    `).join("");
}

async function refreshAuditLogs() {
    const localEntries = loadStoredArray(AUDIT_STORAGE_KEY).map(normalizeAuditEntry);
    let remoteEntries = [];
    let backendAvailable = false;
    if (location.protocol === "http:" || location.protocol === "https:") {
        try {
            const response = await fetch("/api/logs", { cache: "no-store" });
            if (!response.ok) throw new Error("Não foi possível consultar os logs do SQLite.");
            const payload = await response.json();
            remoteEntries = (payload.logs || []).map(normalizeAuditEntry);
            backendAvailable = true;
        } catch (error) {
            console.warn("Consulta de logs do SQLite indisponível:", error);
        }
    }
    const merged = new Map();
    [...localEntries, ...remoteEntries].forEach((entry) => merged.set(entry.id, entry));
    auditEntries = [...merged.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    $("#logs-source-note").textContent = backendAvailable
        ? "Exibindo registros do navegador e do banco SQLite local. O histórico é operacional; não inclui endereço ou telefone dos destinatários."
        : "Exibindo os registros guardados neste navegador. Inicie o servidor Python para consultar também a cópia do SQLite local.";
    renderAuditLogs();
}

function checkBackendStatus() {
    const status = $("#storage-status");
    const indicator = $("#storage-indicator");
    if (!(location.protocol === "http:" || location.protocol === "https:")) {
        status.textContent = "Somente neste navegador";
        indicator.classList.add("offline");
        return;
    }
    fetch("/api/health", { cache: "no-store" })
        .then((response) => { if (!response.ok) throw new Error("Backend indisponível"); return response.json(); })
        .then(() => {
            status.textContent = "SQLite local conectado";
            indicator.classList.remove("offline");
            indicator.classList.add("online");
        })
        .catch(() => {
            status.textContent = "Somente neste navegador";
            indicator.classList.add("offline");
        });
}



function loadStoredArray(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value : [];
    } catch (error) {
        console.warn(`Não foi possível ler ${key}:`, error);
        return [];
    }
}

function saveStoredArray(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        auditLog(key === SALES_STORAGE_KEY ? "sales_saved" : key === CONTACTS_STORAGE_KEY ? "delivery_contacts_saved" : "data_saved", { key, count: value.length });
        syncSnapshotToPython();
        return true;
    } catch (error) {
        console.error(`Não foi possível salvar ${key}:`, error);
        showToast("Não foi possível salvar os dados neste navegador.", "error");
        return false;
    }
}

function paymentMethodLabel(method) {
    return ({ money: "Dinheiro", pix: "Pix", card: "Cartão" })[method] || "Não informado";
}

function currentPaymentMethod() {
    return $('input[name="sale-payment"]:checked')?.value || "money";
}

function currentPriceFor(product, method) {
    return Number(method === "card" ? product.priceCard : product.priceCash) || 0;
}

function roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function getCurrentSaleTotals(lines = getSaleCartLines()) {
    const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.subtotal, 0));
    const type = $("#sale-discount-type")?.value || "amount";
    const rawValue = Math.max(0, Number($("#sale-discount-value")?.value) || 0);
    const requestedDiscount = type === "percent" ? roundMoney(subtotal * rawValue / 100) : roundMoney(rawValue);
    const invalidDiscount = requestedDiscount > subtotal || (type === "percent" && rawValue > 100);
    const discount = Math.min(subtotal, requestedDiscount);
    return { subtotal, discountType: type, discountValue: rawValue, discount, invalidDiscount, total: roundMoney(subtotal - discount) };
}

function updateCashChangePreview() {
    const total = getCurrentSaleTotals().total;
    const received = Number($("#cash-received")?.value);
    const valid = Number.isFinite(received) && received >= total;
    $("#cash-change-preview").textContent = formatCurrency(valid ? roundMoney(received - total) : 0);
    $("#cash-received-hint").textContent = valid ? "Troco calculado automaticamente." : "O valor recebido precisa ser igual ou maior que o total.";
    $("#cash-received-hint").classList.toggle("field-error-text", !valid);
    return { received, change: valid ? roundMoney(received - total) : 0, valid };
}

function saleMeasureMode(product) {
    const unit = normalizeText(product?.unit || "");
    if (unit === "metro linear" || unit === "metro") return "linear";
    if (unit === "metro quadrado") return "area";
    return "unit";
}

function productAreaPerUnit(product) {
    const value = Number(product?.areaPerUnit);
    return Number.isFinite(value) && value > 0 ? value : 0;
}

function productDefaultLength(product) {
    const value = Number(product?.measureLength);
    return Number.isFinite(value) && value > 0 ? value : "";
}

function formatMeasure(value, maximumFractionDigits = 2) {
    return Number(value).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits
    });
}

function priceUnitLabel(product) {
    const mode = saleMeasureMode(product);
    if (mode === "linear") return "por m linear";
    if (mode === "area") return "por m²";
    return `por ${String(product.unit || "unidade").toLowerCase()}`;
}

function productSearchText(product) {
    return normalizeText([
        product.name, product.code, product.reference, product.barcode, product.manufacturerCode, product.brand, product.details,
        categoryLabel(product.category), subcategoryLabel(product.category, product.subcategory),
        productVariation(product), product.unit
    ].filter(Boolean).join(" "));
}

function renderSaleSuggestions() {
    const input = $("#sale-product-search");
    const list = $("#sale-product-suggestions");
    const query = normalizeText(input.value);
    selectedSaleProductId = null;
    $("#add-sale-item").disabled = true;
    $("#selected-product-hint").textContent = "Selecione um produto na lista de resultados.";
    resetSaleMeasurementFields();

    if (!query) {
        list.hidden = true;
        list.innerHTML = "";
        return;
    }

    const matches = products
        .filter((product) => productSearchText(product).includes(query))
        .slice(0, 12);

    if (!matches.length) {
        list.innerHTML = `<div class="suggestion-empty">Nenhum produto encontrado no catálogo.</div>`;
        list.hidden = false;
        return;
    }

    list.innerHTML = matches.map((product) => `
        <button class="sale-suggestion" type="button" data-sale-product-id="${escapeHTML(product.id)}">
            <span><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.code || "Sem código")}${product.reference ? ` · Ref. ${escapeHTML(product.reference)}` : ""} · ${escapeHTML(productVariation(product))} · ${escapeHTML(product.unit || "Unidade")}</small></span>
            <span class="sale-suggestion-price">À vista ${escapeHTML(formatCurrency(product.priceCash))}<br>Normal/cartão ${escapeHTML(formatCurrency(product.priceCard))}<small>${escapeHTML(priceUnitLabel(product))}</small></span>
        </button>
    `).join("");
    list.hidden = false;
}

function updateSaleMeasurementFields(product) {
    const quantityLabel = $("#sale-quantity-label");
    const quantityInput = $("#sale-quantity");
    const lengthField = $("#sale-linear-length-field");
    const coverageField = $("#sale-area-coverage-field");
    const fields = $("#sale-measurement-fields");
    const preview = $("#sale-measure-preview");

    fields.classList.remove("has-secondary");
    lengthField.hidden = true;
    coverageField.hidden = true;
    preview.hidden = true;
    quantityInput.value = "1";

    if (!product) {
        quantityLabel.textContent = "Quantidade";
        $("#sale-length-each").value = "";
        return;
    }

    const mode = saleMeasureMode(product);
    if (mode === "linear") {
        quantityLabel.textContent = "Quantidade de unidades";
        lengthField.hidden = false;
        fields.classList.add("has-secondary");
        $("#sale-length-each").value = productDefaultLength(product);
        preview.hidden = false;
        updateSaleMeasurePreview();
    } else if (mode === "area") {
        const areaPerUnit = productAreaPerUnit(product);
        if (areaPerUnit > 0) {
            const areaUnitLabel = product.areaUnitLabel || "Unidade";
            quantityLabel.textContent = `Quantidade de ${areaUnitLabel.toLowerCase()}s`;
            $("#sale-area-coverage-title").textContent = "Rendimento cadastrado";
            $("#sale-area-coverage-value").textContent = `Cada ${areaUnitLabel.toLowerCase()} corresponde a ${formatMeasure(areaPerUnit)} m².`;
            coverageField.hidden = false;
            fields.classList.add("has-secondary");
        } else {
            quantityLabel.textContent = "Quantidade em m²";
        }
        preview.hidden = false;
        updateSaleMeasurePreview();
    } else {
        quantityLabel.textContent = "Quantidade";
    }
}

function resetSaleMeasurementFields() {
    updateSaleMeasurementFields(null);
}

function updateSaleMeasurePreview() {
    const product = products.find((item) => item.id === selectedSaleProductId);
    const preview = $("#sale-measure-preview");
    if (!product) {
        preview.hidden = true;
        return;
    }

    const quantity = Number($("#sale-quantity").value);
    if (!Number.isFinite(quantity) || quantity <= 0) {
        preview.textContent = "Informe uma quantidade maior que zero.";
        preview.hidden = false;
        return;
    }

    const mode = saleMeasureMode(product);
    if (mode === "linear") {
        const length = Number($("#sale-length-each").value);
        if (!Number.isFinite(length) || length <= 0) {
            preview.textContent = "Informe a medida de cada unidade para calcular os metros lineares.";
        } else {
            const pieceWord = quantity === 1 ? "unidade" : "unidades";
            preview.textContent = `${formatStock(quantity)} ${pieceWord} × ${formatMeasure(length)} m = ${formatMeasure(quantity * length)} m lineares`;
        }
    } else if (mode === "area") {
        const coverage = productAreaPerUnit(product);
        if (coverage > 0) {
            const areaUnitLabel = product.areaUnitLabel || "Unidade";
            const itemWord = quantity === 1 ? areaUnitLabel.toLowerCase() : `${areaUnitLabel.toLowerCase()}s`;
            preview.textContent = `${formatStock(quantity)} ${itemWord} × ${formatMeasure(coverage)} m² = ${formatMeasure(quantity * coverage)} m²`;
        } else {
            preview.textContent = `Quantidade para cobrança: ${formatMeasure(quantity)} m²`;
        }
    } else {
        preview.hidden = true;
        return;
    }
    preview.hidden = false;
}

function selectSaleProduct(id) {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    selectedSaleProductId = id;
    $("#sale-product-search").value = `${product.name} — ${productVariation(product)}`;
    $("#sale-product-suggestions").hidden = true;
    const mode = saleMeasureMode(product);
    const unitDescription = mode === "linear" ? "Preço por metro linear" : mode === "area" ? "Preço por metro quadrado" : `Preço por ${String(product.unit || "unidade").toLowerCase()}`;
    const coverageNote = mode === "area" && productAreaPerUnit(product) > 0
        ? ` Cada unidade cobre ${formatMeasure(productAreaPerUnit(product))} m².`
        : "";
    $("#selected-product-hint").textContent = `${product.code || "Sem código"} · ${unitDescription}: à vista ${formatCurrency(product.priceCash)} · normal/cartão ${formatCurrency(product.priceCard)}.${coverageNote}`;
    updateSaleMeasurementFields(product);
    $("#add-sale-item").disabled = false;
    $("#sale-quantity").focus();
    $("#sale-quantity").select();
}

function addSelectedProductToSale() {
    const product = products.find((item) => item.id === selectedSaleProductId);
    const quantity = Number($("#sale-quantity").value);
    if (!product) {
        showToast("Pesquise e selecione um produto antes de adicionar.", "error");
        $("#sale-product-search").focus();
        return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
        showToast("Informe uma quantidade maior que zero.", "error");
        $("#sale-quantity").focus();
        return;
    }

    const mode = saleMeasureMode(product);
    const line = {
        id: makeId(),
        productId: product.id,
        quantity,
        measureMode: mode,
        lengthEach: null,
        areaPerUnit: productAreaPerUnit(product)
    };

    if (mode === "linear") {
        const lengthEach = Number($("#sale-length-each").value);
        if (!Number.isFinite(lengthEach) || lengthEach <= 0) {
            showToast("Informe a medida de cada unidade em metros.", "error");
            $("#sale-length-each").focus();
            return;
        }
        line.lengthEach = lengthEach;
    }

    const existing = currentSaleItems.find((item) =>
        item.productId === line.productId &&
        (mode !== "linear" || Math.abs(Number(item.lengthEach) - Number(line.lengthEach)) < 0.000001)
    );
    if (existing) existing.quantity += quantity;
    else currentSaleItems.push(line);
    auditLog("sale_item_added", { productId: product.id, code: product.code || "", productName: product.name, quantity, measureMode: mode, lengthEach: line.lengthEach });

    $("#sale-product-search").value = "";
    $("#sale-quantity").value = "1";
    $("#sale-length-each").value = "";
    $("#sale-product-suggestions").hidden = true;
    $("#selected-product-hint").textContent = "Produto adicionado. Pesquise outro item para continuar.";
    selectedSaleProductId = null;
    $("#add-sale-item").disabled = true;
    resetSaleMeasurementFields();
    renderSaleCart();
    $("#sale-product-search").focus();
}

function getSaleCartLines() {
    const method = currentPaymentMethod();
    return currentSaleItems.map((line) => {
        const product = products.find((item) => item.id === line.productId);
        if (!product) return null;
        const mode = line.measureMode || saleMeasureMode(product);
        const quantity = Number(line.quantity);
        const unitPrice = currentPriceFor(product, method);
        let measuredQuantity = quantity;
        let measuredUnit = product.unit || "Unidade";
        let calculationDescription = `${formatStock(quantity)} × ${String(product.unit || "unidade").toLowerCase()}`;
        let quantityLabel = "unidade(s)";
        let priceUnit = priceUnitLabel(product);
        let lengthEach = null;
        let areaPerUnit = 0;

        if (mode === "linear") {
            lengthEach = Number(line.lengthEach);
            measuredQuantity = quantity * lengthEach;
            measuredUnit = "m linear";
            quantityLabel = "unidade(s)";
            const pieceWord = quantity === 1 ? "unidade" : "unidades";
            calculationDescription = `${formatStock(quantity)} ${pieceWord} × ${formatMeasure(lengthEach)} m = ${formatMeasure(measuredQuantity)} m lineares`;
        } else if (mode === "area") {
            areaPerUnit = Number(line.areaPerUnit ?? productAreaPerUnit(product)) || 0;
            measuredQuantity = areaPerUnit > 0 ? quantity * areaPerUnit : quantity;
            measuredUnit = "m²";
            const areaUnitLabel = product.areaUnitLabel || "Unidade";
            quantityLabel = areaPerUnit > 0 ? `${areaUnitLabel.toLowerCase()}(s)` : "m²";
            const itemWord = quantity === 1 ? areaUnitLabel.toLowerCase() : `${areaUnitLabel.toLowerCase()}s`;
            calculationDescription = areaPerUnit > 0
                ? `${formatStock(quantity)} ${itemWord} × ${formatMeasure(areaPerUnit)} m² = ${formatMeasure(measuredQuantity)} m²`
                : `${formatMeasure(measuredQuantity)} m²`;
        }

        return {
            id: line.id,
            product,
            mode,
            quantity,
            lengthEach,
            areaPerUnit,
            measuredQuantity,
            measuredUnit,
            quantityLabel,
            calculationDescription,
            priceUnit,
            unitPrice,
            subtotal: unitPrice * measuredQuantity
        };
    }).filter(Boolean);
}

function renderSaleCart() {
    const body = $("#sale-cart-body");
    const lines = getSaleCartLines();
    if (!lines.length) $("#sale-discount-value").value = "0";
    const totals = getCurrentSaleTotals(lines);
    const total = totals.total;
    const method = currentPaymentMethod();
    const itemCount = lines.reduce((sum, line) => sum + line.measuredQuantity, 0);

    $("#sale-item-count").textContent = `${lines.length} ${lines.length === 1 ? "linha de produto" : "linhas de produtos"}`;
    $("#sale-total").textContent = formatCurrency(total);
    $("#sale-discount-preview").textContent = totals.invalidDiscount
        ? "O desconto não pode ser maior que o valor da venda."
        : `Desconto adicional: ${formatCurrency(totals.discount)}`;
    $("#sale-discount-preview").classList.toggle("field-error-text", totals.invalidDiscount);
    $("#sale-price-mode").textContent = method === "card" ? "Preços de cartão" : "Preços à vista · Dinheiro/Pix";
    $("#sale-cart-empty").hidden = lines.length > 0;
    $(".sale-cart-table-wrap").hidden = lines.length === 0;
    $("#finalize-sale-button").disabled = lines.length === 0 || totals.invalidDiscount;
    $("#clear-sale-button").disabled = lines.length === 0;

    body.innerHTML = lines.map((line) => {
        let quantityControl;
        if (line.mode === "linear") {
            quantityControl = `<div class="cart-measure-controls"><label>Unidades<input class="cart-quantity-input" type="number" min="0.01" step="0.01" value="${escapeHTML(line.quantity)}" data-cart-quantity="${escapeHTML(line.id)}" aria-label="Quantidade de unidades de ${escapeHTML(line.product.name)}"></label><label>m por peça<input class="cart-length-input" type="number" min="0.01" step="0.01" value="${escapeHTML(line.lengthEach)}" data-cart-length="${escapeHTML(line.id)}" aria-label="Medida de cada unidade de ${escapeHTML(line.product.name)}"></label></div>`;
        } else {
            const inputLabel = line.mode === "area" && line.areaPerUnit > 0 ? (line.product.areaUnitLabel || "Unidades") : line.mode === "area" ? "m²" : "Quantidade";
            quantityControl = `<label class="cart-single-quantity">${inputLabel}<input class="cart-quantity-input" type="number" min="0.01" step="0.01" value="${escapeHTML(line.quantity)}" data-cart-quantity="${escapeHTML(line.id)}" aria-label="${inputLabel} de ${escapeHTML(line.product.name)}"></label>`;
        }
        return `
            <tr>
                <td><div class="sale-cart-product"><strong>${escapeHTML(line.product.name)}</strong><small>${escapeHTML(line.product.code || "Sem código")} · ${escapeHTML(productVariation(line.product))}</small><small class="sale-calculation-detail">${escapeHTML(line.calculationDescription)}</small></div></td>
                <td>${escapeHTML(line.measuredUnit)}</td>
                <td><strong>${escapeHTML(formatCurrency(line.unitPrice))}</strong><small class="unit-price-detail">${escapeHTML(line.priceUnit)}</small></td>
                <td>${quantityControl}</td>
                <td><strong>${escapeHTML(formatCurrency(line.subtotal))}</strong></td>
                <td><button class="cart-remove-button" type="button" data-cart-remove="${escapeHTML(line.id)}" title="Remover item" aria-label="Remover ${escapeHTML(line.product.name)}">×</button></td>
            </tr>
        `;
    }).join("");
}

function removeSaleItem(lineId) {
    const line = currentSaleItems.find((item) => item.id === lineId);
    const product = products.find((item) => item.id === line?.productId);
    currentSaleItems = currentSaleItems.filter((item) => item.id !== lineId);
    auditLog("sale_item_removed", { productId: product?.id || "", code: product?.code || "", productName: product?.name || "" });
    renderSaleCart();
}

function changeSaleItemQuantity(lineId, rawValue) {
    const quantity = Number(rawValue);
    if (!Number.isFinite(quantity) || quantity <= 0) {
        showToast("A quantidade precisa ser maior que zero.", "error");
        renderSaleCart();
        return;
    }
    const line = currentSaleItems.find((item) => item.id === lineId);
    if (line) {
        line.quantity = quantity;
        const product = products.find((item) => item.id === line.productId);
        auditLog("sale_item_quantity_changed", { productId: line.productId, code: product?.code || "", productName: product?.name || "", quantity });
    }
    renderSaleCart();
}

function changeSaleItemLength(lineId, rawValue) {
    const length = Number(rawValue);
    if (!Number.isFinite(length) || length <= 0) {
        showToast("A medida de cada unidade precisa ser maior que zero.", "error");
        renderSaleCart();
        return;
    }
    const line = currentSaleItems.find((item) => item.id === lineId);
    if (line) {
        line.lengthEach = length;
        const product = products.find((item) => item.id === line.productId);
        auditLog("sale_item_length_changed", { productId: line.productId, code: product?.code || "", productName: product?.name || "", lengthEach: length });
    }
    renderSaleCart();
}

function clearCurrentSale() {
    if (!currentSaleItems.length) return;
    if (!window.confirm("Deseja limpar todos os produtos desta venda?")) return;
    const removedCount = currentSaleItems.length;
    currentSaleItems = [];
    auditLog("sale_draft_cleared", { removedItemLines: removedCount });
    renderSaleCart();
    showToast("Lista da venda limpa.");
}

function nextSaleNumber() {
    const year = new Date().getFullYear();
    const key = `gestao.comercial.saleCounter.${year}`;
    const next = Number(localStorage.getItem(key) || "0") + 1;
    localStorage.setItem(key, String(next));
    return `VD-${year}-${String(next).padStart(6, "0")}`;
}

function openFinalizeSaleConfirmation() {
    const lines = getSaleCartLines();
    if (!lines.length) {
        showToast("Adicione ao menos um produto antes de finalizar.", "error");
        return;
    }
    const missingPrice = lines.find((line) => !(line.unitPrice > 0));
    if (missingPrice) {
        showToast(`Cadastre um preço válido para “${missingPrice.product.name}” antes de finalizar.`, "error");
        return;
    }
    const totals = getCurrentSaleTotals(lines);
    if (totals.invalidDiscount) {
        showToast("O desconto adicional não pode ultrapassar o valor da venda.", "error");
        return;
    }
    const method = currentPaymentMethod();
    $("#confirm-sale-total").textContent = formatCurrency(totals.total);
    $("#confirm-sale-breakdown").innerHTML = `${totals.discount > 0 ? `<div><span>Subtotal</span><strong>${formatCurrency(totals.subtotal)}</strong></div><div><span>Desconto adicional</span><strong>− ${formatCurrency(totals.discount)}</strong></div>` : `<div><span>Subtotal</span><strong>${formatCurrency(totals.subtotal)}</strong></div>`}`;
    $("#confirm-sale-method").textContent = `Forma de pagamento: ${paymentMethodLabel(method)}. ${method === "card" ? "Foi aplicado o preço normal (cartão)." : "Foi aplicado o preço à vista."}`;
    $("#cash-received-area").hidden = method !== "money";
    if (method === "money") {
        $("#cash-received").value = totals.total.toFixed(2);
        updateCashChangePreview();
    }
    $("#sale-confirm-modal").hidden = false;
    document.body.classList.add("modal-open");
}
function closeFinalizeSaleConfirmation() {
    $("#sale-confirm-modal").hidden = true;
    document.body.classList.remove("modal-open");
}

function finalizeCurrentSale() {
    const method = currentPaymentMethod();
    const lines = getSaleCartLines();
    if (!lines.length) return;
    const totals = getCurrentSaleTotals(lines);
    if (totals.invalidDiscount) {
        showToast("O desconto adicional não pode ultrapassar o valor da venda.", "error");
        return;
    }
    const cash = method === "money" ? updateCashChangePreview() : { received: null, change: 0, valid: true };
    if (!cash.valid) {
        showToast("Informe um valor recebido igual ou maior que o total para calcular o troco.", "error");
        $("#cash-received").focus();
        return;
    }
    const now = new Date();
    const sale = {
        id: makeId(),
        number: nextSaleNumber(),
        createdAt: now.toISOString(),
        paymentMethod: method,
        paymentLabel: paymentMethodLabel(method),
        priceMode: method === "card" ? "card" : "cash",
        items: lines.map((line) => ({
            productId: line.product.id,
            code: line.product.code || "",
            reference: line.product.reference || "",
            manufacturerCode: line.product.manufacturerCode || "",
            name: line.product.name,
            variation: productVariation(line.product),
            unit: line.product.unit || "Unidade",
            quantity: line.quantity,
            measureMode: line.mode,
            lengthEach: line.lengthEach,
            areaPerUnit: line.areaPerUnit,
            measuredQuantity: line.measuredQuantity,
            measuredUnit: line.measuredUnit,
            quantityLabel: line.quantityLabel,
            calculationDescription: line.calculationDescription,
            priceUnit: line.priceUnit,
            unitPrice: line.unitPrice,
            subtotal: line.subtotal
        })),
        subtotal: totals.subtotal,
        extraDiscount: { type: totals.discountType, value: totals.discountValue, amount: totals.discount },
        total: totals.total,
        cashReceived: cash.received,
        change: cash.change,
        delivery: null,
        status: "finalized"
    };

    sales.unshift(sale);
    if (!saveStoredArray(SALES_STORAGE_KEY, sales)) {
        sales.shift();
        return;
    }

    auditLog("sale_finalized", { saleNumber: sale.number, total: sale.total, itemLines: sale.items.length, paymentMethod: sale.paymentMethod });
    currentSaleItems = [];
    $("#sale-discount-type").value = "amount";
    $("#sale-discount-value").value = "0";
    closeFinalizeSaleConfirmation();
    renderSaleCart();
    renderHome();
    renderDocuments();
    renderHistory();
    renderReports();
    showToast(`Venda ${sale.number} finalizada. Para imprimir, pesquise esse número em “Comprovantes e impressão”.`);
}
function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Data não informada";
    return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function paymentLabelForSale(sale) {
    return sale.paymentLabel || paymentMethodLabel(sale.paymentMethod);
}

function getSaleById(id) {
    return sales.find((sale) => sale.id === id);
}

function renderDocuments() {
    const container = $("#documents-results");
    if (!container) return;
    const query = normalizeText($("#documents-search").value);
    const matches = [...sales].filter((sale) => {
        const deliveryName = sale.delivery?.recipient || "";
        return !query || normalizeText(`${sale.number} ${paymentLabelForSale(sale)} ${deliveryName}`).includes(query);
    }).slice(0, 50);

    if (!matches.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">▧</div><strong>${sales.length ? "Nenhuma venda encontrada" : "Ainda não há vendas finalizadas"}</strong><span>${sales.length ? "Confira o número informado e tente novamente." : "Depois de finalizar uma venda, ela aparecerá aqui para impressão."}</span></div>`;
        return;
    }

    container.innerHTML = matches.map((sale) => {
        const delivery = sale.delivery;
        const itemSummary = `${sale.items.length} ${sale.items.length === 1 ? "linha de produto" : "linhas de produtos"} · ${sale.items.slice(0, 2).map((item) => savedItemMeasureDescription(item)).join("; ")}`;
        return `<article class="document-card">
            <div class="document-card-main"><strong>${escapeHTML(sale.number)}</strong><small>${escapeHTML(formatDateTime(sale.createdAt))} · ${escapeHTML(paymentLabelForSale(sale))} · ${itemSummary}${delivery ? ` · Destinatário: ${escapeHTML(delivery.recipient)}` : ""}</small></div>
            <div class="document-card-total">${escapeHTML(formatCurrency(sale.total))}</div>
            <div class="document-card-actions">
                <button class="secondary-button" type="button" data-doc-action="customer-print" data-sale-id="${escapeHTML(sale.id)}">Imprimir via do cliente</button>
                <button class="${delivery ? "secondary-button" : "primary-button"}" type="button" data-doc-action="delivery-setup" data-sale-id="${escapeHTML(sale.id)}">${delivery ? "Editar dados da entrega" : "Preparar via de entrega"}</button>
                ${delivery ? `<button class="secondary-button" type="button" data-doc-action="delivery-print" data-sale-id="${escapeHTML(sale.id)}">Imprimir via de entrega</button><span class="status-pill ${deliveryStatusClass(delivery.status)}">${escapeHTML(deliveryStatusLabel(delivery.status))}</span>` : ""}
            </div>
        </article>`;
    }).join("");
}

function populateDeliveryContacts(selectedId = "") {
    const select = $("#delivery-contact-select");
    select.innerHTML = `<option value="">Preencher dados manualmente</option>` + deliveryContacts.map((contact) =>
        `<option value="${escapeHTML(contact.id)}">${escapeHTML(contact.name)}${contact.phone ? ` · ${escapeHTML(contact.phone)}` : ""}</option>`
    ).join("");
    select.value = selectedId;
}

function fillDeliveryContact(contact) {
    if (!contact) return;
    $("#delivery-recipient").value = contact.name || "";
    $("#delivery-phone").value = contact.phone || "";
    $("#delivery-street").value = contact.street || "";
    $("#delivery-number").value = contact.number || "";
    $("#delivery-neighborhood").value = contact.neighborhood || "";
    $("#delivery-reference").value = contact.reference || "";
    $("#delivery-observations").value = contact.observations || "";
}

function openDeliveryModal(saleId) {
    const sale = getSaleById(saleId);
    if (!sale) return;
    selectedSaleIdForDelivery = saleId;
    $("#delivery-form").reset();
    $("#delivery-sale-id").value = saleId;
    populateDeliveryContacts(sale.delivery?.savedContactId || "");
    if (sale.delivery) {
        const delivery = sale.delivery;
        $("#delivery-recipient").value = delivery.recipient || "";
        $("#delivery-phone").value = delivery.phone || "";
        $("#delivery-street").value = delivery.street || "";
        $("#delivery-number").value = delivery.number || "";
        $("#delivery-neighborhood").value = delivery.neighborhood || "";
        $("#delivery-reference").value = delivery.reference || "";
        $("#delivery-observations").value = delivery.observations || "";
    } else {
        $("#delivery-contact-select").value = "";
    }
    $("#save-delivery-contact").checked = false;
    $("#delivery-modal").hidden = false;
    document.body.classList.add("modal-open");
    window.setTimeout(() => $("#delivery-recipient").focus(), 30);
}

function closeDeliveryModal() {
    $("#delivery-modal").hidden = true;
    document.body.classList.remove("modal-open");
    selectedSaleIdForDelivery = null;
}

function handleDeliverySubmit(event) {
    event.preventDefault();
    const saleId = $("#delivery-sale-id").value;
    const sale = getSaleById(saleId);
    if (!sale || !$("#delivery-form").reportValidity()) return;

    const selectedContactId = $("#delivery-contact-select").value;
    const selectedContact = deliveryContacts.find((contact) => contact.id === selectedContactId);
    const deliveryData = {
        recipient: $("#delivery-recipient").value.trim(),
        phone: $("#delivery-phone").value.trim(),
        street: $("#delivery-street").value.trim(),
        number: $("#delivery-number").value.trim(),
        neighborhood: $("#delivery-neighborhood").value.trim(),
        reference: $("#delivery-reference").value.trim(),
        observations: $("#delivery-observations").value.trim()
    };

    const previousDelivery = sale.delivery ? structuredCloneSafe(sale.delivery) : null;
    const wasExistingDelivery = Boolean(sale.delivery);
    let didSaveContact = false;
    let savedContactId = selectedContact?.id || null;
    if ($("#save-delivery-contact").checked) {
        let contact = selectedContact;
        if (!contact) {
            contact = {
                id: makeId(),
                createdAt: new Date().toISOString()
            };
            deliveryContacts.unshift(contact);
        }
        Object.assign(contact, {
            name: deliveryData.recipient,
            phone: deliveryData.phone,
            street: deliveryData.street,
            number: deliveryData.number,
            neighborhood: deliveryData.neighborhood,
            reference: deliveryData.reference,
            observations: deliveryData.observations,
            updatedAt: new Date().toISOString()
        });
        savedContactId = contact.id;
        if (!saveStoredArray(CONTACTS_STORAGE_KEY, deliveryContacts)) return;
        didSaveContact = true;
        auditLog("delivery_contact_saved", { contactId: contact.id, isNew: !selectedContact });
    }

    sale.delivery = {
        ...deliveryData,
        savedContactId,
        status: sale.delivery?.status || "pending",
        createdAt: sale.delivery?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    if (!saveStoredArray(SALES_STORAGE_KEY, sales)) {
        sale.delivery = previousDelivery;
        return;
    }
    auditLog(wasExistingDelivery ? "delivery_updated" : "delivery_created", { saleNumber: sale.number, saleId: sale.id, savedContact: didSaveContact });
    closeDeliveryModal();
    renderDocuments();
    renderDeliveries();
    renderHome();
    showToast("Dados da entrega salvos. Os produtos da venda foram aproveitados automaticamente.");
}

function deliveryStatusLabel(status) {
    return ({ pending: "Pendente", transit: "Saiu para entrega", delivered: "Entregue", cancelled: "Cancelada" })[status] || "Pendente";
}

function deliveryStatusClass(status) {
    return ({ pending: "status-pending", transit: "status-transit", delivered: "status-delivered", cancelled: "status-cancelled" })[status] || "status-pending";
}

function renderDeliveries() {
    const container = $("#deliveries-list");
    if (!container) return;
    const records = sales.filter((sale) => sale.delivery).sort((a, b) => new Date(b.delivery.updatedAt) - new Date(a.delivery.updatedAt));
    if (!records.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">♧</div><strong>Nenhuma entrega cadastrada</strong><span>Para criar uma via de entrega, finalize uma venda, abra “Comprovantes e impressão”, procure o número e escolha “Preparar via de entrega”.</span></div>`;
        return;
    }
    container.innerHTML = records.map((sale) => {
        const delivery = sale.delivery;
        const address = `${delivery.street || ""}${delivery.number ? `, ${delivery.number}` : ""} · ${delivery.neighborhood || ""}${delivery.reference ? ` · Referência: ${delivery.reference}` : ""}`;
        return `<article class="document-card">
            <div class="document-card-main"><strong>${escapeHTML(sale.number)} · ${escapeHTML(delivery.recipient)}</strong><small>${escapeHTML(delivery.phone || "Sem telefone")} · ${escapeHTML(formatDateTime(sale.createdAt))}</small><div class="delivery-card-address">${escapeHTML(address)}</div></div>
            <div class="document-card-total"><span class="status-pill ${deliveryStatusClass(delivery.status)}">${escapeHTML(deliveryStatusLabel(delivery.status))}</span></div>
            <div class="document-card-actions"><select class="delivery-status-select" data-delivery-status="${escapeHTML(sale.id)}" aria-label="Situação da entrega"><option value="pending" ${delivery.status === "pending" ? "selected" : ""}>Pendente</option><option value="transit" ${delivery.status === "transit" ? "selected" : ""}>Saiu para entrega</option><option value="delivered" ${delivery.status === "delivered" ? "selected" : ""}>Entregue</option><option value="cancelled" ${delivery.status === "cancelled" ? "selected" : ""}>Cancelada</option></select><button class="secondary-button" type="button" data-doc-action="delivery-print" data-sale-id="${escapeHTML(sale.id)}">Imprimir via de entrega</button><button class="secondary-button" type="button" data-doc-action="delivery-setup" data-sale-id="${escapeHTML(sale.id)}">Editar dados</button></div>
        </article>`;
    }).join("");
}

function updateDeliveryStatus(saleId, status) {
    const sale = getSaleById(saleId);
    if (!sale?.delivery) return;
    const previousStatus = sale.delivery.status || "pending";
    if (previousStatus === status) return;
    const previousUpdatedAt = sale.delivery.updatedAt;
    sale.delivery.status = status;
    sale.delivery.updatedAt = new Date().toISOString();
    if (!saveStoredArray(SALES_STORAGE_KEY, sales)) {
        sale.delivery.status = previousStatus;
        sale.delivery.updatedAt = previousUpdatedAt;
        return;
    }
    auditLog("delivery_status_changed", { saleNumber: sale.number, previousStatus, newStatus: status });
    renderDeliveries();
    renderDocuments();
    renderHome();
    showToast(`Situação da entrega atualizada: ${deliveryStatusLabel(status)}.`);
}

function renderHistory() {
    const container = $("#history-results");
    if (!container) return;
    const query = normalizeText($("#history-search").value);
    const matches = sales.filter((sale) => normalizeText(`${sale.number} ${paymentLabelForSale(sale)} ${sale.items.map((item) => item.name).join(" ")}`).includes(query));
    if (!matches.length) {
        container.innerHTML = `<div class="empty-state"><strong>${sales.length ? "Nenhuma venda corresponde à pesquisa" : "Nenhuma venda registrada"}</strong><span>As vendas finalizadas aparecerão aqui.</span></div>`;
        return;
    }
    container.innerHTML = matches.map((sale) => `<article class="document-card"><div class="document-card-main"><strong>${escapeHTML(sale.number)}</strong><small>${escapeHTML(formatDateTime(sale.createdAt))} · ${escapeHTML(paymentLabelForSale(sale))} · ${sale.items.length} linha(s) de produto</small></div><div class="document-card-total">${escapeHTML(formatCurrency(sale.total))}</div><div class="document-card-actions"><button class="secondary-button" type="button" data-open-sale-documents="${escapeHTML(sale.number)}">Localizar para impressão</button></div></article>`).join("");
}

function renderHome() {
    const today = new Date().toDateString();
    const todaySales = sales.filter((sale) => new Date(sale.createdAt).toDateString() === today);
    const todayTotal = todaySales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const pendingDeliveries = sales.filter((sale) => sale.delivery && ["pending", "transit"].includes(sale.delivery.status)).length;
    $("#home-sales-count").textContent = String(sales.length);
    $("#home-sales-total").textContent = formatCurrency(todayTotal);
    $("#home-deliveries-count").textContent = String(pendingDeliveries);
    $("#home-products-count").textContent = String(products.length);
    const recent = $("#home-recent-sales");
    const latest = [...sales].slice(0, 4);
    recent.innerHTML = latest.length ? latest.map((sale) => `<div class="recent-sale-row"><div><strong>${escapeHTML(sale.number)}</strong><small>${escapeHTML(formatDateTime(sale.createdAt))} · ${escapeHTML(paymentLabelForSale(sale))}</small></div><b>${escapeHTML(formatCurrency(sale.total))}</b></div>`).join("") : "Nenhuma venda foi finalizada ainda.";
}

function renderReports() {
    const total = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const cashTotal = sales.filter((sale) => sale.paymentMethod !== "card").reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const cardTotal = sales.filter((sale) => sale.paymentMethod === "card").reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    $("#report-sales-count").textContent = String(sales.length);
    $("#report-sales-total").textContent = formatCurrency(total);
    $("#report-cash-total").textContent = formatCurrency(cashTotal);
    $("#report-card-total").textContent = formatCurrency(cardTotal);
}

function getBusinessSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(BUSINESS_SETTINGS_KEY) || "{}");
        return {
            name: saved.name || localStorage.getItem(BUSINESS_NAME_KEY) || "Varejo+",
            document: saved.document || "", address: saved.address || "", city: saved.city || "",
            phone: saved.phone || "", whatsapp: saved.whatsapp || "", pix: saved.pix || "", message: saved.message || ""
        };
    } catch (error) {
        return { name: localStorage.getItem(BUSINESS_NAME_KEY) || "Varejo+", document: "", address: "", city: "", phone: "", whatsapp: "", pix: "", message: "" };
    }
}

function businessName() {
    return getBusinessSettings().name;
}

function printBusinessIdentity() {
    const info = getBusinessSettings();
    const lines = [];
    const address = [info.address, info.city].filter(Boolean).join(" · ");
    if (address) lines.push(`<div class="print-store-meta">${escapeHTML(address)}</div>`);
    const contactParts = [];
    if (info.phone) contactParts.push(`Tel.: ${escapeHTML(info.phone)}`);
    if (info.document) contactParts.push(`CNPJ/CPF: ${escapeHTML(info.document)}`);
    if (contactParts.length) lines.push(`<div class="print-store-meta">${contactParts.join(" · ")}</div>`);
    return lines.join("");
}

function printBusinessFooter({ includePix = true } = {}) {
    const info = getBusinessSettings();
    const parts = [];
    if (info.message) parts.push(`<div><strong>Mensagem:</strong> ${escapeHTML(info.message)}</div>`);
    if (info.whatsapp) parts.push(`<div><strong>WhatsApp:</strong> ${escapeHTML(info.whatsapp)}</div>`);
    if (includePix && info.pix) parts.push(`<div><strong>Pix:</strong> ${escapeHTML(info.pix)}</div>`);
    return parts.length ? `<footer class="print-business-footer">${parts.join("")}</footer>` : "";
}

function savedItemMeasureDescription(item) {
    if (item.calculationDescription) return item.calculationDescription;
    const mode = item.measureMode;
    if (mode === "linear" && Number(item.lengthEach) > 0) {
        const metres = Number(item.quantity) * Number(item.lengthEach);
        return `${formatStock(item.quantity)} peça(s) × ${formatMeasure(item.lengthEach)} m = ${formatMeasure(metres)} m lineares`;
    }
    if (mode === "area") {
        const area = Number(item.measuredQuantity ?? item.quantity) || 0;
        return `${formatMeasure(area)} m²`;
    }
    return `${formatStock(item.quantity)} ${String(item.unit || "unidade").toLowerCase()}(s)`;
}

function printDateAndTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { date: "Data não informada", time: "" };
    return {
        date: date.toLocaleDateString("pt-BR"),
        time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    };
}

function printDocumentHeader(sale, title) {
    const when = printDateAndTime(sale.createdAt);
    return `<header class="print-header">
        <div class="print-document-title">${escapeHTML(title)}</div>
        <div class="print-separator"></div>
        <div class="print-store-name">${escapeHTML(businessName())}</div>
        ${printBusinessIdentity()}
        <div class="print-order-meta"><div><strong>Pedido:</strong> ${escapeHTML(sale.number)}</div><div><strong>Data:</strong> ${escapeHTML(when.date)}${when.time ? ` &nbsp; <strong>Hora:</strong> ${escapeHTML(when.time)}` : ""}</div></div>
    </header>`;
}

function printItemIdentification(item) {
    const parts = [];
    if (item.code) parts.push(`Cód.: ${item.code}`);
    if (item.reference) parts.push(`Ref.: ${item.reference}`);
    if (item.manufacturerCode) parts.push(`Fab.: ${item.manufacturerCode}`);
    if (item.variation) parts.push(item.variation);
    return parts.length ? `<div class="print-item-identification">${escapeHTML(parts.join(" · "))}</div>` : "";
}

function pluralizePrintLabel(label, quantity) {
    const clean = String(label || "unidade").replace(/\(s\)/gi, "").trim();
    if (Number(quantity) === 1) return clean;
    const lower = clean.toLowerCase();
    if (["uni", "un", "unid", "kg", "g", "mg", "l", "ml", "m", "m²", "cx", "pct"].includes(lower)) return clean;
    if (lower.endsWith("a")) return `${clean.slice(0, -1)}as`;
    if (lower.endsWith("ão")) return `${clean.slice(0, -2)}ões`;
    if (lower.endsWith("s")) return clean;
    return `${clean}s`;
}

function printItemQuantityDescription(item) {
    const quantity = Number(item.quantity) || 0;
    if (item.measureMode === "linear") {
        return `${formatStock(quantity)} ${pluralizePrintLabel("unidade", quantity)} × ${formatMeasure(item.lengthEach || 0)} m = ${formatMeasure(item.measuredQuantity || 0)} m lineares`;
    }
    if (item.measureMode === "area") {
        if (Number(item.areaPerUnit) > 0) {
            const label = pluralizePrintLabel(item.quantityLabel || "unidade", quantity);
            return `${formatStock(quantity)} ${label} × ${formatMeasure(item.areaPerUnit)} m² = ${formatMeasure(item.measuredQuantity || 0)} m²`;
        }
        return `${formatMeasure(item.measuredQuantity ?? quantity)} m²`;
    }
    return `${formatStock(quantity)} ${pluralizePrintLabel(item.unit || "unidade", quantity)}`;
}

function printItemPriceUnit(item) {
    if (item.measureMode === "linear") return "/ m linear";
    if (item.measureMode === "area") return "/ m²";
    return `/ ${String(item.unit || "unidade").trim()}`;
}

function renderPrintCustomerItems(sale) {
    return sale.items.map((item, index) => `<article class="print-line-item">
        <div class="print-item-heading"><span class="print-item-index">${index + 1}.</span><strong>${escapeHTML(item.name)}</strong></div>
        ${printItemIdentification(item)}
        <div class="print-item-quantity">${escapeHTML(printItemQuantityDescription(item))}</div>
        <div class="print-item-calculation"><span>Preço: ${escapeHTML(formatCurrency(item.unitPrice))} ${escapeHTML(printItemPriceUnit(item))}</span><strong>Total: ${escapeHTML(formatCurrency(item.subtotal))}</strong></div>
    </article>`).join("");
}

function renderPrintCustomerNote(sale) {
    const subtotal = Number(sale.subtotal ?? sale.total) || 0;
    const discount = Number(sale.extraDiscount?.amount) || 0;
    const total = Number(sale.total) || 0;
    const cashLines = sale.paymentMethod === "money" && sale.cashReceived !== null && sale.cashReceived !== undefined
        ? `<div class="print-summary-row"><span>Valor recebido</span><strong>${escapeHTML(formatCurrency(sale.cashReceived))}</strong></div><div class="print-summary-row print-change-row"><span>Troco</span><strong>${escapeHTML(formatCurrency(sale.change || 0))}</strong></div>`
        : "";

    return `<article class="print-document print-receipt print-customer-receipt">
        ${printDocumentHeader(sale, "NOTA SEM VALOR FISCAL · VIA DO CLIENTE")}
        <section class="print-section">
            <div class="print-section-title">RELAÇÃO DOS PRODUTOS</div>
            <div class="print-separator"></div>
            ${renderPrintCustomerItems(sale)}
        </section>
        <section class="print-summary">
            <div class="print-separator"></div>
            <div class="print-summary-heading">RESUMO DA VENDA</div>
            <div class="print-summary-row"><span>Valor dos produtos</span><strong>${escapeHTML(formatCurrency(subtotal))}</strong></div>
            ${discount > 0 ? `<div class="print-summary-row"><span>Desconto adicional</span><strong>− ${escapeHTML(formatCurrency(discount))}</strong></div>` : ""}
            <div class="print-summary-row print-grand-total"><span>TOTAL DA NOTA</span><strong>${escapeHTML(formatCurrency(total))}</strong></div>
            <div class="print-payment-lines"><div><strong>Pagamento:</strong> ${escapeHTML(paymentLabelForSale(sale))}</div>${cashLines}</div>
        </section>
        ${printBusinessFooter({ includePix: true })}
        <div class="print-disclaimer">Documento comercial de controle da venda. Não é nota fiscal.</div>
    </article>`;
}

function printDeliveryInformation(delivery) {
    const rows = [];
    if (delivery.recipient) rows.push(`<div><strong>Destinatário:</strong> ${escapeHTML(delivery.recipient)}</div>`);
    if (delivery.phone) rows.push(`<div><strong>Telefone:</strong> ${escapeHTML(delivery.phone)}</div>`);
    const streetLine = [delivery.street, delivery.number ? `Nº ${delivery.number}` : ""].filter(Boolean).join(", ");
    if (streetLine) rows.push(`<div><strong>Endereço:</strong> ${escapeHTML(streetLine)}</div>`);
    if (delivery.neighborhood) rows.push(`<div><strong>Bairro/localidade:</strong> ${escapeHTML(delivery.neighborhood)}</div>`);
    if (delivery.reference) rows.push(`<div><strong>Referência:</strong> ${escapeHTML(delivery.reference)}</div>`);
    if (delivery.observations) rows.push(`<div class="print-delivery-observations"><strong>Instruções:</strong> ${escapeHTML(delivery.observations)}</div>`);
    return `<section class="print-recipient-block"><div class="print-section-title">DADOS PARA ENTREGA</div><div class="print-separator"></div>${rows.join("")}</section>`;
}

function renderPrintDeliveryItems(sale) {
    return sale.items.map((item, index) => `<article class="print-line-item print-delivery-item">
        <div class="print-item-heading"><span class="print-item-index">${index + 1}.</span><strong>${escapeHTML(item.name)}</strong></div>
        ${printItemIdentification(item)}
        <div class="print-item-quantity">${escapeHTML(printItemQuantityDescription(item))}</div>
    </article>`).join("");
}

function renderPrintDeliveryNote(sale) {
    const delivery = sale.delivery;
    if (!delivery) return "";
    return `<article class="print-document print-receipt print-delivery-receipt">
        ${printDocumentHeader(sale, "ORDEM DE ENTREGA")}
        ${printDeliveryInformation(delivery)}
        <section class="print-section print-delivery-products">
            <div class="print-section-title">PRODUTOS PARA SEPARAR</div>
            <div class="print-separator"></div>
            ${renderPrintDeliveryItems(sale)}
        </section>
        ${printBusinessFooter({ includePix: false })}
        <div class="print-disclaimer">Documento interno para separação e entrega. Não contém valores da venda.</div>
    </article>`;
}

function printSaleDocument(saleId, type) {
    const sale = getSaleById(saleId);
    if (!sale) return;
    if (type === "delivery" && !sale.delivery) {
        showToast("Cadastre os dados da entrega antes de imprimir essa via.", "error");
        return;
    }
    const root = $("#print-root");
    root.innerHTML = type === "customer" ? renderPrintCustomerNote(sale) : renderPrintDeliveryNote(sale);
    auditLog("document_print_requested", { saleNumber: sale.number, documentType: type });
    document.body.classList.add("printing");
    pendingPrintCleanup = true;
    window.print();
}

function cleanupPrint() {
    if (!pendingPrintCleanup) return;
    document.body.classList.remove("printing");
    $("#print-root").innerHTML = "";
    pendingPrintCleanup = false;
}

function navigateToView(viewName) {
    const view = $(`#view-${CSS.escape(viewName)}`);
    if (!view) return;
    $$(".page-view").forEach((section) => { section.hidden = section !== view; });
    $$(".nav-link[data-view]").forEach((link) => {
        const active = link.dataset.view === viewName;
        link.classList.toggle("active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
    });
    const link = $(`.nav-link[data-view="${CSS.escape(viewName)}"]`);
    $("#breadcrumb-current").textContent = link?.dataset.module || "Início";
    if (viewName === "home") renderHome();
    if (viewName === "sales") { renderSaleCart(); $("#sale-product-search").focus(); }
    if (viewName === "documents") renderDocuments();
    if (viewName === "deliveries") renderDeliveries();
    if (viewName === "history") renderHistory();
    if (viewName === "reports") renderReports();
    if (viewName === "logs") refreshAuditLogs();
}


function handleModuleNavigation(event) {
    const link = event.target.closest("a[data-module][data-view]");
    if (!link) return;
    event.preventDefault();
    navigateToView(link.dataset.view);
}

function populateBusinessSettings() {
    const info = getBusinessSettings();
    $("#business-name").value = info.name;
    $("#business-document").value = info.document;
    $("#business-address").value = info.address;
    $("#business-city").value = info.city;
    $("#business-phone").value = info.phone;
    $("#business-whatsapp").value = info.whatsapp;
    $("#business-pix").value = info.pix;
    $("#business-message").value = info.message;
}

function populateBusinessSettings() {
    const info = getBusinessSettings();
    $("#business-name").value = info.name;
    $("#business-document").value = info.document;
    $("#business-address").value = info.address;
    $("#business-city").value = info.city;
    $("#business-phone").value = info.phone;
    $("#business-whatsapp").value = info.whatsapp;
    $("#business-pix").value = info.pix;
    $("#business-message").value = info.message;
}

function bindEvents() {
    // Navegação e botões de acesso rápido.
    $$(".sidebar-nav").forEach((nav) => nav.addEventListener("click", handleModuleNavigation));
    document.addEventListener("click", (event) => {
        const go = event.target.closest("[data-go-view]");
        if (go) navigateToView(go.dataset.goView);
    });

    // Produtos: cadastro, edição, filtros e ações existentes.
    $("#new-product-button").addEventListener("click", () => openProductModal());
    elements.form.addEventListener("submit", handleProductSubmit);
    elements.category.addEventListener("change", () => {
        populateSubcategorySelect();
        });
    elements.search.addEventListener("input", () => { currentPage = 1; renderProducts(); });
    elements.categoryFilter.addEventListener("change", () => {
        currentPage = 1;
        updateFilterSubcategories();
        renderProducts();
    });
    elements.subcategoryFilter.addEventListener("change", () => { currentPage = 1; renderProducts(); });
    elements.previousPage.addEventListener("click", () => { if (currentPage > 1) { currentPage--; renderProducts(); } });
    elements.nextPage.addEventListener("click", () => {
        const totalPages = Math.max(1, Math.ceil(getFilteredProducts().length / PAGE_SIZE));
        if (currentPage < totalPages) { currentPage++; renderProducts(); }
    });
    elements.tableBody.addEventListener("click", handleTableClick);
    elements.customizeColumnsButton.addEventListener("click", () => toggleColumnPanel());
    elements.columnPanel.addEventListener("change", applyColumnVisibility);
    $$('[data-close-modal]').forEach((button) => button.addEventListener("click", closeProductModal));
    elements.modal.addEventListener("click", (event) => { if (event.target === elements.modal) closeProductModal(); });

    // Fluxo de venda: pesquisar → quantidade → adicionar → finalizar.
    $("#sale-product-search").addEventListener("input", renderSaleSuggestions);
    $("#sale-product-search").addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            const first = $("#sale-product-suggestions [data-sale-product-id]");
            if (first && !selectedSaleProductId) selectSaleProduct(first.dataset.saleProductId);
            else if (selectedSaleProductId) addSelectedProductToSale();
        }
        if (event.key === "Escape") $("#sale-product-suggestions").hidden = true;
    });
    $("#sale-product-suggestions").addEventListener("click", (event) => {
        const option = event.target.closest("[data-sale-product-id]");
        if (option) selectSaleProduct(option.dataset.saleProductId);
    });
    $("#add-sale-item").addEventListener("click", addSelectedProductToSale);
    $("#sale-quantity").addEventListener("input", updateSaleMeasurePreview);
    $("#sale-length-each").addEventListener("input", updateSaleMeasurePreview);
    $("#sale-quantity").addEventListener("keydown", (event) => {
        if (event.key === "Enter") { event.preventDefault(); addSelectedProductToSale(); }
    });
    $("#sale-length-each").addEventListener("keydown", (event) => {
        if (event.key === "Enter") { event.preventDefault(); addSelectedProductToSale(); }
    });
    elements.unit.addEventListener("change", updateProductUnitFields);
    $$('input[name="sale-payment"]').forEach((radio) => radio.addEventListener("change", renderSaleCart));
    $("#sale-discount-type").addEventListener("change", renderSaleCart);
    $("#sale-discount-value").addEventListener("input", renderSaleCart);
    $("#cash-received").addEventListener("input", updateCashChangePreview);
    $("#sale-cart-body").addEventListener("change", (event) => {
        const quantityInput = event.target.closest("[data-cart-quantity]");
        const lengthInput = event.target.closest("[data-cart-length]");
        if (quantityInput) changeSaleItemQuantity(quantityInput.dataset.cartQuantity, quantityInput.value);
        if (lengthInput) changeSaleItemLength(lengthInput.dataset.cartLength, lengthInput.value);
    });
    $("#sale-cart-body").addEventListener("click", (event) => {
        const button = event.target.closest("[data-cart-remove]");
        if (button) removeSaleItem(button.dataset.cartRemove);
    });
    $("#clear-sale-button").addEventListener("click", clearCurrentSale);
    $("#finalize-sale-button").addEventListener("click", openFinalizeSaleConfirmation);
    $("#confirm-finalize-sale").addEventListener("click", finalizeCurrentSale);
    $$('[data-close-sale-confirm]').forEach((button) => button.addEventListener("click", closeFinalizeSaleConfirmation));
    $("#sale-confirm-modal").addEventListener("click", (event) => { if (event.target.id === "sale-confirm-modal") closeFinalizeSaleConfirmation(); });

    // Busca de venda e impressão posterior.
    $("#documents-search").addEventListener("input", renderDocuments);
    $("#clear-documents-search").addEventListener("click", () => { $("#documents-search").value = ""; renderDocuments(); });
    $("#documents-results").addEventListener("click", (event) => {
        const button = event.target.closest("[data-doc-action]");
        if (!button) return;
        const { docAction, saleId } = button.dataset;
        if (docAction === "customer-print") printSaleDocument(saleId, "customer");
        if (docAction === "delivery-setup") openDeliveryModal(saleId);
        if (docAction === "delivery-print") printSaleDocument(saleId, "delivery");
    });

    // Cadastro opcional do destinatário, dentro do fluxo da entrega.
    $("#delivery-contact-select").addEventListener("change", (event) => {
        const contact = deliveryContacts.find((item) => item.id === event.target.value);
        if (contact) fillDeliveryContact(contact);
        else if (!selectedSaleIdForDelivery || !getSaleById(selectedSaleIdForDelivery)?.delivery) {
            $("#delivery-recipient").value = "";
            $("#delivery-phone").value = "";
            $("#delivery-street").value = "";
            $("#delivery-number").value = "";
            $("#delivery-neighborhood").value = "";
            $("#delivery-reference").value = "";
            $("#delivery-observations").value = "";
        }
    });
    $("#delivery-form").addEventListener("submit", handleDeliverySubmit);
    $$('[data-close-delivery-modal]').forEach((button) => button.addEventListener("click", closeDeliveryModal));
    $("#delivery-modal").addEventListener("click", (event) => { if (event.target.id === "delivery-modal") closeDeliveryModal(); });

    // Acompanhamento e histórico.
    $("#deliveries-list").addEventListener("change", (event) => {
        const select = event.target.closest("[data-delivery-status]");
        if (select) updateDeliveryStatus(select.dataset.deliveryStatus, select.value);
    });
    $("#deliveries-list").addEventListener("click", (event) => {
        const button = event.target.closest("[data-doc-action]");
        if (!button) return;
        if (button.dataset.docAction === "delivery-print") printSaleDocument(button.dataset.saleId, "delivery");
        if (button.dataset.docAction === "delivery-setup") openDeliveryModal(button.dataset.saleId);
    });
    $("#history-search").addEventListener("input", renderHistory);
    $("#history-results").addEventListener("click", (event) => {
        const button = event.target.closest("[data-open-sale-documents]");
        if (!button) return;
        $("#documents-search").value = button.dataset.openSaleDocuments;
        navigateToView("documents");
        renderDocuments();
    });

    // Dados opcionais da empresa para o cabeçalho e rodapé das vias impressas.
    populateBusinessSettings();
    $("#settings-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const info = {
            name: $("#business-name").value.trim() || "Varejo+",
            document: $("#business-document").value.trim(),
            address: $("#business-address").value.trim(),
            city: $("#business-city").value.trim(),
            phone: $("#business-phone").value.trim(),
            whatsapp: $("#business-whatsapp").value.trim(),
            pix: $("#business-pix").value.trim(),
            message: $("#business-message").value.trim()
        };
        try {
            localStorage.setItem(BUSINESS_SETTINGS_KEY, JSON.stringify(info));
            localStorage.setItem(BUSINESS_NAME_KEY, info.name);
            auditLog("settings_updated", { fieldsUpdated: Object.keys(info).filter((key) => Boolean(info[key])).length });
            showToast("Identificação da loja atualizada nos documentos.");
        } catch (error) {
            showToast("Não foi possível salvar as configurações neste navegador.", "error");
        }
    });

    $("#logs-search").addEventListener("input", renderAuditLogs);
    $("#logs-action-filter").addEventListener("change", renderAuditLogs);
    $("#logs-date-filter").addEventListener("change", renderAuditLogs);
    $("#refresh-logs-button").addEventListener("click", refreshAuditLogs);

    $("#notification-button").addEventListener("click", () => showToast("O centro de notificações será desenvolvido em uma etapa futura."));

    document.addEventListener("click", (event) => {
        if (!event.target.closest(".action-menu-wrap")) closeActionMenus();
        if (!event.target.closest(".column-control")) toggleColumnPanel(false);
        if (!event.target.closest(".sale-product-picker")) $("#sale-product-suggestions").hidden = true;
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            if (!elements.modal.hidden) closeProductModal();
            if (!$("#sale-confirm-modal").hidden) closeFinalizeSaleConfirmation();
            if (!$("#delivery-modal").hidden) closeDeliveryModal();
            closeActionMenus();
            toggleColumnPanel(false);
            $("#sale-product-suggestions").hidden = true;
        }
    });
    window.addEventListener("afterprint", cleanupPrint);
}

function initialize() {
    updateFilterSubcategories();
    populateSubcategorySelect();
    bindEvents();
    renderProducts();
    renderSaleCart();
    renderHome();
    renderDocuments();
    renderDeliveries();
    renderHistory();
    renderReports();
    navigateToView("home");
    console.log("Gestão Comercial: produtos, vendas, documentos e entregas carregados.");
    auditLog("application_opened", { version: "2.0.0" });
    checkBackendStatus();
    syncSnapshotToPython();
}

initialize();
