import * as XLSX from "xlsx";

export type SalesRow = {
  fecha: string; cod_cliente: string; cliente: string; direccion?: string; ciudad: string;
  linea_de_producto: string; factura_nro: string; cod2?: string; codigo_producto: string;
  producto: string; costo: number; total: number; monto_en?: string; monto_usd: number; vendedor: string;
  mercado?: string;
};
export type TargetRow = { visitador: string; linea_de_producto: string; meses: Record<string, number>; total: number; };
export type ConoftaTargetRow = { anio: number; meses: Record<string, number>; revenue_per_surgery: number; sucursal?: string; tipo_cirugia?: string; };
export type ClientRow = { 
  name: string; 
  first_name?: string; 
  last_name?: string; 
  cod_cliente?: string;
  contact_name?: string; 
  city?: string; 
  address?: string; 
  email?: string; 
  phone?: string; 
  segment?: string; 
  pricing_level?: string; 
  market_type?: string; 
};
export type StockRow = { codigo_producto: string; producto: string; lote_sn: string; fecha_vencimiento: string; };
export interface ConoftaSurgeryRow {
  jornada_id: string;
  fecha: string;
  sucursal?: string;
  medico?: string;
  paciente?: string;
  cedula_paciente?: string;
  cod_unico_paciente?: string;
  procedimiento?: string;
  ojo?: string;
  producto_sku?: string;
  producto_nombre?: string;
  dioptria?: number;
  descripcion_lente?: string;
  cantidad?: number;
  costo_unitario?: number;
  tipo_costo: "directo" | "indirecto";
  honorarios?: number;
}

function findVal(row: any, keywords: string[]): any {
  if (!row) return null;
  const keys = Object.keys(row);
  const foundKey = keys.find(k => {
    const cleanK = k.toString().trim().toUpperCase();
    return keywords.some(kw => cleanK.includes(kw.toUpperCase()));
  });
  return foundKey ? row[foundKey] : null;
}

/** Exact-match version — only returns a value if the column name equals one of the keywords exactly. */
function findValExact(row: any, keywords: string[]): any {
  if (!row) return null;
  const keys = Object.keys(row);
  const foundKey = keys.find(k =>
    keywords.some(kw => k.toString().trim().toUpperCase() === kw.toUpperCase())
  );
  return foundKey ? row[foundKey] : null;
}

function findValueByPriority(row: any, priorityGroups: string[][]): any {
  for (const group of priorityGroups) {
    const val = findVal(row, group);
    if (val !== null && val !== undefined && val !== "") return val;
  }
  return null;
}

export function detectTemplate(headers: string[]): "ventas" | "targets" | "clientes" | "stock" | "conofta_targets" | "conofta_surgeries" | "conofta_indirect_costs" | "conofta_product_costs" | "conofta_expenses" | "conofta_surgeon_fees" | null {
  const upper = headers.map(h => h?.toString().trim().toUpperCase());
  // Ventas: FECHA + (FAC or NRO) + (CODIGO or PRODUCTO)
  if (upper.includes("FECHA") && upper.some(h => h.includes("FAC") || h.includes("NRO")) && upper.some(h => h.includes("CODIGO") || h.includes("PRODUCTO"))) return "ventas";
  if (upper.some(h => h.includes("VISITADOR")) && upper.some(h => h.includes("ENERO"))) return "targets";
  if (upper.some(h => h.includes("VALOR CIRURGIA") || h.includes("VALOR CIRUGIA") || h.includes("REVENUE"))) return "conofta_targets";
  if (upper.some(h => h.includes("LOTE") || h.includes("SN")) && upper.some(h => h.includes("VENCIMIENTO"))) return "stock";
  if (upper.some(h => h.includes("UNIDAD QUIRURGICA")) && upper.some(h => h.includes("COD JORNADA")) && upper.some(h => h.includes("CEDULA PACIENTE"))) return "conofta_surgeries";
  if (upper.some(h => h.includes("COD JORNADA")) && upper.some(h => h.includes("DESCRIPCION DEL PRODUCTO") || h.includes("PRODUCTO") || h.includes("INSUMO")) && upper.some(h => h.includes("CANTIDAD"))) return "conofta_indirect_costs";
  if (upper.includes("COD_MEDICO_SUC") || upper.includes("HONORARIO POR CIRUGIA") || upper.includes("COSTO REFERENCIA")) {
    if (upper.includes("HONORARIO POR CIRUGIA")) return "conofta_surgeon_fees";
    if (upper.includes("COSTO REFERENCIA")) return "conofta_product_costs";
  }
  // New simple cost list format: CODIGO, DESCRIPCION, COSTO
  if (upper.some(h => h === "CODIGO" || h === "COD" || h === "COD PRODUCTO") && upper.some(h => h.includes("DESCRIPCION")) && upper.some(h => h === "COSTO" || h === "COSTO UNITARIO")) return "conofta_product_costs";
  if (upper.some(h => h.includes("ITEM") || h.includes("SKU")) && upper.some(h => h.includes("COSTO"))) return "conofta_product_costs";
  if (upper.some(h => h.includes("CATEGORIA") || h.includes("CAT")) && upper.some(h => h.includes("VALOR") || h.includes("MONTO"))) return "conofta_expenses";
  return null;
}

export function parseExcelDate(val: any): string {
  if (!val) return "";
  if (typeof val === "number") {
    try {
      const d = XLSX.SSF.parse_date_code(val);
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    } catch { return ""; }
  }
  const s = String(val).trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return s;
}

export function toNum(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return val;
  const s = String(val).trim();
  const cleaned = s.replace(/[^0-9,.]/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  if (lastComma > lastDot) {
    // 1.234,56 -> 1234.56
    return Number(cleaned.replace(/\./g, "").replace(",", "."));
  } else if (lastDot > lastComma) {
    // Check if it's 1.234 (thousand) or 1.23 (decimal)
    const parts = cleaned.split(".");
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      // 1.234 or 1.234.567 -> thousand separator
      return Number(cleaned.replace(/\./g, ""));
    }
    // 1.23 -> decimal
    return Number(cleaned);
  }
  return Number(cleaned);
}

export function parseSalesSheet(sheet: XLSX.WorkSheet): { rows: SalesRow[]; errors: string[] } {
  const data = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
  const rows: SalesRow[] = [];
  data.forEach((raw) => {
    const fecha = parseExcelDate(findVal(raw, ["FECHA", "DATE"]));
    // Use exact match for CLIENTE to avoid matching "COD CLIENTE"
    const cliente = String(
      findValExact(raw, ["CLIENTE"]) ||
      findVal(raw, ["NOMBRE CLIENTE", "RAZON SOCIAL", "NOMBRE DEL CLIENTE"]) ||
      ""
    ).trim();
    if (!fecha || !cliente) return;

    // ── Column mapping (confirmed by user) ────────────────────────────────
    // Col K: COSTO     = unit cost per item         → stored in costo
    // Col L: CANT      = quantity of units sold      → stored in total (legacy field name)
    // Col M: MONTO     = total amount in Guaraní     → ignored for USD dashboard
    // Col N: MONTO USD = total amount in USD         → stored in monto_usd (= REVENUE)

    const montoUsdRaw = findValExact(raw, [
      "MONTO USD", "MONTO EN USD", "MONTO DOLARES", "USD",
      "MONTO FACTURADO", "IMPORTE", "TOTAL USD", "VALOR USD"
    ]);
    const cantRaw = findValExact(raw, ["CANT", "CANTIDAD", "QTY", "UNIDADES", "UNITS", "QTDE"]);

    const montoEnRaw = findValExact(raw, ["MONTO EN", "MONEDA", "CURRENCY"]) ||
                       findVal(raw, ["MONTO EN", "MONEDA EN"]);
    const montoEn = montoEnRaw ? String(montoEnRaw).trim() : "USD";

    rows.push({
      fecha, cliente,
      cod_cliente: String(
        findValExact(raw, ["COD CLIENTE", "COD. CLIENTE"]) ||
        findVal(raw, ["CODIGO CLIENTE"]) ||
        ""
      ),
      direccion: String(findVal(raw, ["DIRECCION"]) || ""),
      ciudad: String(findVal(raw, ["CIUDAD"]) || ""),
      linea_de_producto: String(
        findValExact(raw, ["LINEA DE PRODUCTO"]) ||
        findVal(raw, ["LINEA", "LINEA PRODUCTO", "LINEA DE PRODUC"]) ||
        ""
      ),
      factura_nro: String(
        findValExact(raw, ["FAC. NRO", "FAC NRO", "FACTURA NRO", "FACTURA"]) ||
        findVal(raw, ["FAC", "NRO FACTURA"]) ||
        ""
      ),
      cod2:    String(findVal(raw, ["COD2", "COD 2"]) || ""),
      codigo_producto: String(
        findValExact(raw, ["CODIGO PRODUCTO"]) ||
        findVal(raw, ["SKU", "COD PRODUCTO"]) ||
        ""
      ),
      producto: String(
        findValExact(raw, ["PRODUCTO"]) ||
        findVal(raw, ["DESCRIPCION PRODUCTO", "NOMBRE PRODUCTO"]) ||
        ""
      ),
      // Unit cost — dashboard multiplies by CANT to get total row cost
      costo:    toNum(findValExact(raw, ["COSTO"])),
      // Quantity of units sold (CANT column L)
      total:    toNum(cantRaw),
      monto_en: montoEn,
      // Revenue in USD (MONTO USD column N) — primary financial metric
      monto_usd: toNum(montoUsdRaw || findVal(raw, ["MONTO"])),
      vendedor: String(findVal(raw, ["VENDEDOR"]) || ""),
      mercado:  String(findVal(raw, ["MERCADO"]) || "Privado")
    });
  });
  return { rows, errors: [] };
}

export function parseConoftaSurgeriesSheet(sheet: XLSX.WorkSheet): { rows: ConoftaSurgeryRow[], errors: string[] } {
  const data = XLSX.utils.sheet_to_json<any>(sheet);
  const rows: ConoftaSurgeryRow[] = [];
  let lastJ = ""; let lastF = "";
  data.forEach(r => {
    const jId = String(findVal(r, ["COD JORNADA", "JORNADA"]) || lastJ || "").trim();
    const fVal = findVal(r, ["FECHA DE CIRUGIA", "FECHA"]) || lastF;
    const pac = findVal(r, ["NOMBRE COMPLETO", "PACIENTE", "PACIENTE"]);
    if (!jId || !fVal || !pac) return;
    lastJ = jId; lastF = parseExcelDate(fVal);
    rows.push({
      jornada_id: jId, fecha: lastF,
      sucursal: String(findVal(r, ["UNIDAD QUIRURGICA", "SUCURSAL", "UBICACION"]) || ""),
      medico: String(findVal(r, ["CIRUJANO PRINCIPAL", "CIRUJANO", "MEDICO"]) || ""),
      paciente: String(pac),
      cedula_paciente: String(findVal(r, ["CEDULA PACIENTE", "CEDULA", "CI"]) || ""),
      cod_unico_paciente: String(findVal(r, ["COD UNICO PACIENTE", "COD UNICO"]) || ""),
      procedimiento: String(findVal(r, ["PROCEDIMIENTO QUIRURGICO", "PROCEDIMIENTO", "CIRUGIA"]) || ""),
      ojo: String(findVal(r, ["OJO"]) || ""),
      producto_sku: String(findVal(r, ["COD LENTE", "SKU", "CODIGO"]) || ""),
      producto_nombre: String(findVal(r, ["DESCRIPCION LENTE", "PRODUCTO", "LENTE"]) || ""),
      dioptria: toNum(findVal(r, ["DIOPTRIA"])),
      cantidad: 1,
      tipo_costo: "directo", honorarios: 0
    });
  });
  return { rows, errors: [] };
}

export function parseConoftaIndirectCostsSheet(sheet: XLSX.WorkSheet): { rows: ConoftaSurgeryRow[], errors: string[] } {
  const data = XLSX.utils.sheet_to_json<any>(sheet);
  const rows: ConoftaSurgeryRow[] = [];
  let lastJ = ""; let lastF = "";
  data.forEach(r => {
    const jId = String(findVal(r, ["COD JORNADA", "JORNADA"]) || lastJ || "").trim();
    const fVal = findVal(r, ["FECHA", "FECHA JORNADA"]) || lastF;
    const prod = findVal(r, ["DESCRIPCION DEL PRODUCTO", "DESCRIPCIÓN", "PRODUCTO", "INSUMO"]);
    if (!jId || !fVal || !prod) return;
    lastJ = jId; lastF = parseExcelDate(fVal);
    rows.push({
      jornada_id: jId, fecha: lastF,
      producto_sku: String(findVal(r, ["COD PRODUCTO", "COD", "SKU"]) || ""),
      producto_nombre: String(prod),
      cantidad: toNum(findVal(r, ["CANTIDAD", "CANT"])),
      tipo_costo: "indirecto", costo_unitario: 0, honorarios: 0
    });
  });
  return { rows, errors: [] };
}

export function parseConoftaProductCostsSheet(sheet: XLSX.WorkSheet): { rows: any[], errors: string[] } {
  const data = XLSX.utils.sheet_to_json<any>(sheet);
  const rows: any[] = [];
  data.forEach(r => {
    const sucursal = String(findVal(r, ["SUCURSAL", "UNIDAD", "QUIRURGICA", "UBICACION"]) || "").trim();
    const sucursalVal = sucursal === "" ? null : sucursal;
    const anio = toNum(findVal(r, ["ANO", "ANIO", "AÑO", "YEAR"])) || new Date().getFullYear();

    const codigo = String(findVal(r, ["CODIGO", "COD PRODUCTO", "COD", "SKU", "CODIGO PRODUCTO"]) || "").trim();
    const descripcion = String(findVal(r, ["DESCRIPCION", "DESCRIPCION PRODUCTO", "NOMBRE PRODUCTO", "NOMBRE"]) || "").trim();

    // Dual cost columns:
    // COSTO ALCON  → used for Alcon Surgical margin calculations
    // COSTO CONOFTA / COSTO → unit cost per surgery in the CONOFTA project
    const costoAlcon = toNum(findVal(r, ["COSTO ALCON", "COSTO ALCON USD"]));
    const costoConofta = toNum(findVal(r, ["COSTO CONOFTA", "COSTO", "COSTO UNITARIO", "COSTO REFERENCIA", "PRECIO COSTO", "P. COSTO"]));
    // If only one cost column present, use it for both
    const effectiveCostoAlcon = costoAlcon > 0 ? costoAlcon : costoConofta;
    const effectiveCostoConofta = costoConofta > 0 ? costoConofta : costoAlcon;

    const honorario = toNum(findVal(r, ["HONORARIO POR CIRUGIA", "HONORARIO", "HONORARIO BASE"]));

    if (codigo) {
      rows.push({ item_name: codigo, anio, costo_unitario: effectiveCostoConofta, costo_alcon: effectiveCostoAlcon, honorario_base: honorario, sucursal: sucursalVal });
      if (descripcion && descripcion.toUpperCase() !== codigo.toUpperCase()) {
        rows.push({ item_name: descripcion, anio, costo_unitario: effectiveCostoConofta, costo_alcon: effectiveCostoAlcon, honorario_base: honorario, sucursal: sucursalVal });
      }
    } else {
      const item = findValueByPriority(r, [
        ["NOMBRE MEDICO", "MEDICO", "CIRUJANO"],
        ["DESCRIPCION DEL PRODUCTO", "ITEM", "PRODUCTO", "PROCEDIMIENTO", "LENTE"]
      ]);
      if (!item) return;
      rows.push({ item_name: String(item).trim(), anio, costo_unitario: effectiveCostoConofta, costo_alcon: effectiveCostoAlcon, honorario_base: honorario, sucursal: sucursalVal });
    }
  });
  return { rows, errors: [] };
}

export function parseConoftaExpensesSheet(sheet: XLSX.WorkSheet): { rows: any[], errors: string[] } {
  const data = XLSX.utils.sheet_to_json<any>(sheet);
  const rows: any[] = [];
  const M_MAP: any = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
  data.forEach(r => {
    const mRaw = String(findVal(r, ["MES", "MONTH"]) || "").toLowerCase().trim();
    const m = M_MAP[mRaw] || parseInt(mRaw);
    if (!m) return;
    rows.push({
      anio: Number(findVal(r, ["ANO", "ANIO", "AÑO"]) || 2026),
      mes: m,
      sucursal: String(findVal(r, ["SUCURSAL", "UNIDAD", "UBICACION", "SEDE"]) || "").trim(),
      categoria: String(findVal(r, ["CATEGORIA", "CAT", "TIPO GASTO"]) || "").toUpperCase(),
      monto: toNum(findVal(r, ["VALOR", "MONTO", "TOTAL", "AMOUNT", "MONTO USD"]))
    });
  });
  return { rows, errors: [] };
}

export function parseConoftaTargetsSheet(sheet: XLSX.WorkSheet) {
  const data = XLSX.utils.sheet_to_json<any>(sheet);
  const rows: any[] = [];
  data.forEach(raw => {
    const anio = Number(findVal(raw, ["ANO", "ANIO", "AÑO"]) || 2026);
    const revenue = toNum(findVal(raw, ["VALOR CIRURGIA", "VALOR CIRUGIA", "VALOR", "REVENUE", "UNITARIO"]));
    const sucursal = findVal(raw, ["SUCURSAL", "SEDE", "UNIDAD"]);
    const tipo = findVal(raw, ["TIPO", "CIRUGIA", "MODALIDAD"]) || "Catarata";
    const meses: any = {};
    ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"].forEach(m => meses[m] = toNum(findVal(raw, [m])));
    rows.push({ anio, meses, revenue_per_surgery: revenue, sucursal, tipo_cirugia: tipo });
  });
  return { rows, errors: [] };
}

export function parseConoftaSurgeonFeesSheet(sheet: XLSX.WorkSheet) { return parseConoftaProductCostsSheet(sheet); }
export function parseTargetsSheet(sheet?: XLSX.WorkSheet): { rows: TargetRow[]; errors: string[]; warnings: string[] } {
  if (!sheet) return { rows: [], errors: [], warnings: [] };
  const data = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
  const rows: TargetRow[] = [];
  const warnings: string[] = [];
  const MES_NAMES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  data.forEach((raw) => {
    const visitador = String(
      findVal(raw, ["VISITADOR", "VENDEDOR", "REP", "NOMBRE"]) || ""
    ).trim();
    const linea = String(
      findVal(raw, ["LINEA", "LINEA DE PRODUCTO", "LINEA PRODUCTO", "PRODUCTO"]) || ""
    ).trim();
    if (!visitador || !linea) return;
    const meses: Record<string, number> = {};
    let total = 0;
    MES_NAMES.forEach(m => {
      const v = toNum(findVal(raw, [m.toUpperCase(), m]));
      meses[m] = v;
      total += v;
    });
    const explicitTotal = toNum(findVal(raw, ["TOTAL"]));
    rows.push({ visitador, linea_de_producto: linea, meses, total: explicitTotal || total });
  });
  if (rows.length === 0) warnings.push("No se encontraron filas válidas. Verifique que las columnas Visitador, Linea y los meses estén presentes.");
  return { rows, errors: [], warnings };
}
export function parseClientsSheet(sheet: XLSX.WorkSheet): { rows: ClientRow[]; errors: string[] } {
  const data = XLSX.utils.sheet_to_json<any>(sheet);
  const rows: ClientRow[] = [];
  data.forEach(r => {
    const rawName = String(findVal(r, ["NOMBRE", "CLIENTE", "MEDICO", "DOCTOR"]) || "").trim();
    if (!rawName) return;

    let firstName = String(findVal(r, ["PRIMER NOMBRE", "FIRST NAME", "NOMBRE SOLO"]) || "").trim();
    let lastName = String(findVal(r, ["APELLIDO", "LAST NAME", "APELLIDOS"]) || "").trim();

    // If split names aren't provided, try to split the full name
    if (!firstName && rawName) {
      const parts = rawName.split(" ");
      firstName = parts[0];
      lastName = parts.slice(1).join(" ");
    }

    rows.push({
      name: rawName || `${firstName} ${lastName}`.trim(),
      first_name: firstName,
      last_name: lastName,
      cod_cliente: String(findVal(r, ["CODIGO CLIENTE", "COD CLIENTE", "CODIGO", "ID CLIENTE"]) || ""),
      contact_name: String(findVal(r, ["CONTACTO", "CONTACT_NAME"]) || ""),
      city: String(findVal(r, ["CIUDAD", "CITY", "UBICACION"]) || ""),
      address: String(findVal(r, ["DIRECCION", "ADDRESS"]) || ""),
      email: String(findVal(r, ["EMAIL", "CORREO"]) || ""),
      phone: String(findVal(r, ["TELEFONO", "PHONE", "CELULAR"]) || ""),
      segment: String(findVal(r, ["SEGMENTO", "SEGMENT", "CATEGORIA"]) || "check_in").toLowerCase().replace("-", "_"),
      pricing_level: String(findVal(r, ["NIVEL PRECIO", "PRICING", "NIVEL"]) || "D").toUpperCase(),
      market_type: String(findVal(r, ["MERCADO", "MARKET", "TIPO MERCADO"]) || "Privado")
    });
  });
  return { rows, errors: [] };
}
export function parseStockSheet(sheet?: XLSX.WorkSheet): { rows: StockRow[]; errors: string[] } {
  if (!sheet) return { rows: [], errors: [] };
  const data = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
  const rows: StockRow[] = [];
  data.forEach((r: any) => {
    const cod = String(findVal(r, ["CODIGO PRODUCTO", "COD PRODUCTO", "SKU", "CODIGO"]) || "").trim();
    const prod = String(findVal(r, ["PRODUCTO", "DESCRIPCION", "NOMBRE"]) || "").trim();
    const lote = String(findVal(r, ["LOTE", "LOTE SN", "SN", "SERIE"]) || "").trim();
    const venc = parseExcelDate(findVal(r, ["VENCIMIENTO", "FECHA VENCIMIENTO", "EXPIRY"]) || "");
    if (!cod || !lote) return;
    rows.push({ codigo_producto: cod, producto: prod, lote_sn: lote, fecha_vencimiento: venc });
  });
  return { rows, errors: [] };
}

export function downloadTemplate(type: string) {
  const wb = XLSX.utils.book_new();
  const currentYear = new Date().getFullYear();

  if (type === "ventas") {
    const data = [{
      FECHA: "01/01/" + currentYear,
      "COD CLIENTE": "C001",
      CLIENTE: "CLIENTE EJEMPLO",
      DIRECCION: "CALLE FALSA 123",
      CIUDAD: "ASUNCION",
      LINEA: "ATIOLs",
      FAC: "001-001-0000001",
      "CODIGO PRODUCTO": "P001",
      PRODUCTO: "PRODUCTO EJEMPLO",
      COSTO: 100.50,        // Costo unitario del producto
      CANT: 1,              // Cantidad de unidades vendidas
      "MONTO EN": "USD",
      "MONTO USD": 150.00,  // Total facturado (COSTO unitario × CANT)
      VENDEDOR: "JUAN PEREZ",
      MERCADO: "Privado"
    }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Ventas");
  } else if (type === "targets") {
    const data = [{
      Visitador: "JUAN PEREZ",
      "Linea de Producto": "ATIOLs",
      Enero: 1000, Febrero: 1000, Marzo: 1000, Abril: 1000, Mayo: 1000, Junio: 1000,
      Julio: 1000, Agosto: 1000, Septiembre: 1000, Octubre: 1000, Noviembre: 1000, Diciembre: 1000,
      Total: 12000
    }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Targets");
  } else if (type === "clientes") {
    const data = [{
      "COD CLIENTE": "C123",
      NOMBRE: "MARCELO",
      APELLIDO: "VILLACA",
      CONTACTO: "SECRETARIA MARIA",
      CIUDAD: "ASUNCION",
      DIRECCION: "AV. ESPAÑA 1234",
      EMAIL: "marcelo@ejemplo.com",
      TELEFONO: "0981 123 456",
      SEGMENTO: "Grow", // Check-in, Grow, Partner, Protect
      "NIVEL PRECIO": "A", // A, B, C, D
      MERCADO: "Privado"
    }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Clientes");
  }
 else if (type === "conofta_jornada_completa") {
    const p = [{
      "UNIDAD QUIRURGICA": "CONOFTA MARIA AUXILIADORA",
      "COD JORNADA": "J001",
      "NOMBRE COMPLETO": "JUAN PUEBLO",
      "CEDULA PACIENTE": "1234567",
      "FECHA DE CIRUGIA": "01/01/" + currentYear,
      "COD UNICO PACIENTE": "U001",
      "PROCEDIMIENTO QUIRURGICO": "CATARATA",
      OJO: "OD",
      "CIRUJANO PRINCIPAL": "FABIO VERA",
      "COD LENTE": "SA60AC",
      DIOPTRIA: 20.5,
      "DESCRIPCION LENTE": "ACRYSOF IQ"
    }];
    const i = [{
      "COD JORNADA": "J001",
      FECHA: "01/01/" + currentYear,
      "COD PRODUCTO": "P001",
      "DESCRIPCION DEL PRODUCTO": "GUANTES ESTERILES",
      CANTIDAD: 2
    }];
    const h = [{
      "NOMBRE MEDICO": "FABIO VERA",
      SUCURSAL: "CONOFTA MARIA AUXILIADORA",
      "HONORARIO POR CIRUGIA": 320
    }, {
      "NOMBRE MEDICO": "LIZ CARDOZO",
      SUCURSAL: "CONOFTA CORONEL OVIEDO",
      "HONORARIO POR CIRUGIA": 250
    }];
    const c = [{
      "DESCRIPCION DEL PRODUCTO": "GUANTES ESTERILES",
      "COSTO REFERENCIA": 1.5
    }, {
      "DESCRIPCION DEL PRODUCTO": "SA60AC",
      "COSTO REFERENCIA": 61.23
    }];
    const g = [{
      ANO: currentYear,
      MES: "Enero",
      SUCURSAL: "CONOFTA MARIA AUXILIADORA",
      CATEGORIA: "RH",
      DESCRIPCION: "SALARIOS ENERO",
      VALOR: 2500
    }];
    const m = [{
      ANO: currentYear,
      "VALOR CIRURGIA": 1200,
      SUCURSAL: "CONOFTA MARIA AUXILIADORA",
      TIPO: "Catarata",
      ENERO: 10, FEBRERO: 10, MARZO: 10, ABRIL: 10, MAYO: 10, JUNIO: 10, JULIO: 10, AGOSTO: 10, SEPTIEMBRE: 10, OCTUBRE: 10, NOVIEMBRE: 10, DICIEMBRE: 10
    }];

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(p), "Pacientes");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(i), "Insumos por jornada");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(h), "Honorarios Medicos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(c), "Costos Insumos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(g), "Gastos Mensuales");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(m), "Metas y Ingresos");
  } else if (type === "conofta_product_costs") {
    const yr = new Date().getFullYear();
    const data = [
      // COSTO ALCON   = custo de referencia Alcon Surgical (calculo de margen del negocio privado/publico)
      // COSTO CONOFTA = custo real por cirugia en el proyecto CONOFTA (puede diferir por descuentos, subsidios)
      { ANO: yr, CODIGO: "SA60AC", DESCRIPCION: "ACRYSOF IQ MONOFOCAL 1-PIECE", "COSTO ALCON": 61.23, "COSTO CONOFTA": 58.00, "HONORARIO POR CIRUGIA": 0 },
      { ANO: yr, CODIGO: "SN60WF", DESCRIPCION: "ACRYSOF IQ NATURAL 1-PIECE", "COSTO ALCON": 75.50, "COSTO CONOFTA": 72.00, "HONORARIO POR CIRUGIA": 0 },
      { ANO: yr, CODIGO: "MA60AC", DESCRIPCION: "ACRYSOF MONOFOCAL AZUL-LIGHT", "COSTO ALCON": 55.00, "COSTO CONOFTA": 52.00, "HONORARIO POR CIRUGIA": 0 },
      { ANO: yr, CODIGO: "GUANT001", DESCRIPCION: "GUANTES ESTERILES TALLA 6.5", "COSTO ALCON": 1.50, "COSTO CONOFTA": 1.50, "HONORARIO POR CIRUGIA": 0 },
      { ANO: yr, CODIGO: "VISCO001", DESCRIPCION: "VISCO HEALON PRO 0.85ML", "COSTO ALCON": 45.00, "COSTO CONOFTA": 43.00, "HONORARIO POR CIRUGIA": 0 },
      { ANO: yr, CODIGO: "PAKT002", DESCRIPCION: "SOLUCION BSS PLUS 500ML", "COSTO ALCON": 18.00, "COSTO CONOFTA": 18.00, "HONORARIO POR CIRUGIA": 0 },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Costos Productos");
  }

  XLSX.writeFile(wb, `Template_${type}.xlsx`);
}
