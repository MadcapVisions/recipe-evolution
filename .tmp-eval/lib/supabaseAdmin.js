"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSupabaseAdminClient = createSupabaseAdminClient;
require("server-only");
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseConfig_1 = require("@/lib/supabaseConfig");
let supabaseAdminClient = null;
function createSupabaseAdminClient() {
    if (supabaseAdminClient) {
        return supabaseAdminClient;
    }
    const { supabaseUrl } = (0, supabaseConfig_1.getSupabasePublicEnv)();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!serviceRoleKey) {
        throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
    }
    supabaseAdminClient = (0, supabase_js_1.createClient)(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
    return supabaseAdminClient;
}
