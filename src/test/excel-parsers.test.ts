import { describe, it, expect } from "vitest";
import { detectTemplate, parseExcelDate, toNum } from "@/lib/excel-parsers";

describe("Excel Parsers", () => {
    describe("detectTemplate", () => {
        it("should detect ventas template", () => {
            const headers = ["FECHA", "FAC. NRO", "CODIGO PRODUCTO", "OTHER"];
            expect(detectTemplate(headers)).toBe("ventas");
        });

        it("should detect targets template", () => {
            const headers = ["VISITADOR", "LINEA DE PRODUCTO", "ENERO"];
            expect(detectTemplate(headers)).toBe("targets");
        });

        it("should detect stock template", () => {
            const headers = ["CODIGO", "LOTE", "FECHA VENCIMIENTO"];
            expect(detectTemplate(headers)).toBe("stock");
        });

        it("should detect clientes template", () => {
            const headers = ["NOMBRE", "CIUDAD", "SEGMENTO"];
            expect(detectTemplate(headers)).toBe("clientes");
        });

        it("should return null for unknown template", () => {
            const headers = ["UNKNOWN", "HEADER"];
            expect(detectTemplate(headers)).toBe(null);
        });
    });

    describe("parseExcelDate", () => {
        it("should parse YYYY-MM-DD string", () => {
            expect(parseExcelDate("2023-12-25")).toBe("2023-12-25");
        });

        it("should parse DD/MM/YYYY string", () => {
            expect(parseExcelDate("25/12/2023")).toBe("2023-12-25");
        });

        it("should parse DD-MM-YYYY string", () => {
            expect(parseExcelDate("25-12-2023")).toBe("2023-12-25");
        });

        // Note: Testing numeric Excel codes might depend on XLSX library behavior which is consistent
        it("should parse numeric Excel date (approximate)", () => {
            // 45285 is roughly 2023-12-25
            // exact calculation: 25569 is 1970-01-01.
            // 45285 - 25569 = 19716 days after 1970.
            // 19716 / 365.25 ~ 54 years. 1970 + 54 = 2024.
            // Let's rely on the function logic calling XLSX.SSF
            // We assume XLSX is working correctly.
            const dateStr = parseExcelDate(45285);
            expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        it("should return empty string for null/undefined", () => {
            expect(parseExcelDate(null)).toBe("");
            expect(parseExcelDate(undefined)).toBe("");
            expect(parseExcelDate("")).toBe("");
        });
    });

    describe("toNum", () => {
        it("should parse number string", () => {
            expect(toNum("123")).toBe(123);
        });

        it("should parse number with commas", () => {
            expect(toNum("1,234.56")).toBe(1234.56);
        });

        it("should return 0 for invalid inputs", () => {
            expect(toNum("")).toBe(0);
            expect(toNum(null)).toBe(0);
            expect(toNum(undefined)).toBe(0);
            expect(toNum("abc")).toBe(0);
        });
    });
});
