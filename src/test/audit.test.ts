import { describe, it, expect, vi, beforeEach } from "vitest";

// Define mocks before implementation
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: "test-user-id" } } });

// Correct way to mock module with hoisted variables or factory
vi.mock("@/integrations/supabase/client", () => {
    return {
        supabase: {
            from: (...args: any[]) => mockFrom(...args),
            auth: {
                getUser: () => mockGetUser(),
            },
        },
    };
});

import { useAudit } from "../hooks/useAudit";

describe("useAudit Hook", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should log actions to supabase", async () => {
        const { logAction } = useAudit();

        await logAction("IMPORT_DATA", { filename: "test.xlsx" }, "sales_imports", "123");

        expect(mockGetUser).toHaveBeenCalled();
        expect(mockFrom).toHaveBeenCalledWith("audit_log");
        expect(mockInsert).toHaveBeenCalledWith({
            user_id: "test-user-id",
            action: "IMPORT_DATA",
            entity_type: "sales_imports",
            entity_id: "123",
            details: { filename: "test.xlsx" },
            gps_lat: undefined,
            gps_lon: undefined,
        });
    });

    it("should extract gps coordinates if present", async () => {
        const { logAction } = useAudit();

        const detailsWithGps = {
            filename: "geo.xlsx",
            gps: { lat: -25.3, lon: -57.6 }
        };

        await logAction("CREATE_ORDER", detailsWithGps);

        expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
            action: "CREATE_ORDER",
            gps_lat: -25.3,
            gps_lon: -57.6,
            details: { filename: "geo.xlsx" },
        }));
    });

    it("should handle error gracefully", async () => {
        mockInsert.mockRejectedValueOnce(new Error("Network error"));
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => { });

        const { logAction } = useAudit();

        await expect(logAction("LOGOUT")).resolves.not.toThrow();

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});
