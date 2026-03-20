"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabasePublicEnv = getSupabasePublicEnv;
exports.hasSupabasePublicEnv = hasSupabasePublicEnv;
const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
function requireSupabaseUrl() {
    if (!NEXT_PUBLIC_SUPABASE_URL) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
    }
    return NEXT_PUBLIC_SUPABASE_URL;
}
function requireSupabaseAnonKey() {
    if (!NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    return NEXT_PUBLIC_SUPABASE_ANON_KEY;
}
function getSupabasePublicEnv() {
    return {
        supabaseUrl: requireSupabaseUrl(),
        supabaseAnonKey: requireSupabaseAnonKey(),
    };
}
function hasSupabasePublicEnv() {
    return Boolean(NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
