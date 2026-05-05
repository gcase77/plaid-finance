import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

const jwt = "eyJhbGciOiJFUzI1NiIsImtpZCI6ImYzNGI3ZjAzLTMwNzEtNGVmNi04OWRhLWRmOGE0Njc0NTg4YiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3Z1c3p4dHJieXF0b2R6enBqcGpnLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI5YWY5NTBiNy0zOGE3LTRjM2QtYWVlMi0xMDI2MWNlNGUzMjAiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzcyMTc5NTA3LCJpYXQiOjE3NzIxNzU5MDcsImVtYWlsIjoiZ3JpZmZpbmVjYXNlN0BnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoiZ3JpZmZpbmVjYXNlN0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiI5YWY5NTBiNy0zOGE3LTRjM2QtYWVlMi0xMDI2MWNlNGUzMjAifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3MjE3NTkwN31dLCJzZXNzaW9uX2lkIjoiNjg3NWFlYzAtYTQzMy00Njk1LWE1Y2QtMjU5ZTM2MWUwNDBhIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.JZ1g3n125ZdzJIkI7D8mWJxb20_EV_ipWDhITQcWR0dgKacd1IY0VwywvNVYPp8hUFHJkFH5z6_jo_HzMi4kxw"
// Compare how the JSONs of getClaims and getUser differ for the same JWT


let Claims;
try {
  Claims = await supabase.auth.getUser(jwt);
  if (Claims.error) {
    console.error("getClaims returned error:", Claims.error);
  } else {
    console.log("Claims:", Claims.data);
  }
} catch (e) {
  console.error("Caught exception while calling getClaims:", e);
}


