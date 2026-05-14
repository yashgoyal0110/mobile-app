#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  TirthRide - e-rickshaw booking app for Govardhan (Mathura). 
  Phase 1 enhancements requested:
  1. Real map-based location picker (Ola/Uber style) using free OSM provider, swappable to Google later
  2. Real road distance using OSRM (not haversine)
  3. Scrollable login/otp/role-select screens for web preview
  4. Full-name collection on first signup, direct login if returning user
  5. Refactor backend to modular routers for scalability
  6. Admin landmarks CRUD UI

backend:
  - task: "Modular backend refactor (auth, users, config, drivers, rides, suggestions, admin, geo)"
    implemented: true
    working: true
    file: "/app/backend/server.py and /app/backend/app/routes/*"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "All routes mounted, existing flows pass regression. server.py thin entry (64 lines) imports modular routers."

  - task: "Geo proxy endpoints (/api/geo/search, /reverse, /route, /region)"
    implemented: true
    working: true
    file: "/app/backend/app/routes/geo.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Nominatim search returns >=1 results for 'radha kund' and 'deeg'. OSRM route returns real polyline + distance >5km + source 'osrm'. Reverse geocode returns expected fields."

  - task: "First-time signup with name collection"
    implemented: true
    working: true
    file: "/app/backend/app/routes/auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Verify-otp without name returns requires_name:true; OTP not consumed; resubmit with name returns access_token. Role conflict 403. Admin verifies without name (seeded)."

  - task: "Admin landmarks CRUD"
    implemented: true
    working: true
    file: "/app/backend/app/routes/admin.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "GET/POST/PATCH/DELETE all working. Initial 10 seeded landmarks. Adds/updates/removes correctly reflected."

  - task: "WebSocket realtime dispatch (Phase 2)"
    implemented: true
    working: true
    file: "/app/backend/app/routes/ws.py and /app/backend/app/realtime.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added WS endpoint /api/ws?token=<jwt> with JWT auth via query param. ConnectionManager broadcasts ride_requested to eligible drivers on POST /rides. Drivers receive ride_taken when another driver accepts. Passenger receives ride_accepted, ride_started, ride_completed, ride_cancelled. Drivers also push live `location` messages over WS which are forwarded to the assigned passenger as driver_location events."
      - working: true
        agent: "testing"
        comment: "All WS flows pass via ws://localhost:8001/api/ws?token=<jwt>. Invalid token rejected. Valid passenger gets {type:hello, role:passenger, user_id}. ping→pong works. ride_requested broadcast to both online+approved drivers (no-location fallback). ride_taken delivered to other drivers on accept. ride_accepted delivered to passenger w/ driver info. ride_started, ride_completed (with fare), ride_cancelled (by=passenger, reason) all delivered end-to-end. NOTE: WS through the preview HTTPS ingress fails with 307→https redirect (websockets lib then rejects the https scheme). Using ws://localhost:8001 works fine. Main agent may want to check ingress WebSocket support if external clients (mobile) need to connect through preview URL — but EXPO_PUBLIC_BACKEND_URL is mapped, so wss:// should also work in production ingress. Recommend verifying ingress nginx has `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection \"upgrade\"`."

  - task: "Targeted dispatch with radius filter (Phase 2)"
    implemented: true
    working: true
    file: "/app/backend/app/routes/rides.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Ride creation now queries online+approved drivers, filters by haversine distance against pickup against admin-configurable dispatch_radius_km (default 5km). Drivers without known location fall through to broadcast (graceful fallback). Sorted by distance ascending."
      - working: true
        agent: "testing"
        comment: "Driver A at (27.498,77.461) within 5km of Govardhan pickup got ride_requested; Driver B at (28.0,78.0) ~100km away did NOT. Ride still persisted with status=requested, driver_id=null. Graceful fallback also verified — drivers without current_lat/lng get broadcast normally."

  - task: "Driver location tracking (Phase 2)"
    implemented: true
    working: true
    file: "/app/backend/app/routes/drivers.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added POST /api/drivers/location (REST fallback) and WS message {type:'location', lat, lng}. Stored on driver doc. Forwarded to active passenger on WS as driver_location event."
      - working: true
        agent: "testing"
        comment: "POST /api/drivers/location returns {ok:true} and persists current_lat/lng. GET /rides/{id} as passenger after accept returns driver_location:{lat,lng}. WS {type:'location'} from driver is forwarded to the assigned passenger as {type:'driver_location', ride_id, lat, lng} with the exact values."

  - task: "Expo push notifications (Phase 2)"
    implemented: true
    working: true
    file: "/app/backend/app/realtime.py and /app/backend/app/routes/users.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/users/push-token registers Expo push token on user doc. Backend invokes Expo Push API (https://exp.host/--/api/v2/push/send) for ride lifecycle events to user(s) whose app is backgrounded. Tokens must start with ExponentPushToken to be sent."
      - working: true
        agent: "testing"
        comment: "POST /api/users/push-token with ExponentPushToken[...] returns {ok:true} and stores expo_push_token on user doc. Non-Expo-formatted tokens (e.g. 'abc') are accepted/stored without crashing and the push send path filters them out gracefully (no HTTP call to exp.host). MOCKED in the sense that the test does not assert that Expo Push API actually delivered — only that the token is filtered/skipped properly client-side at send time."

  - task: "Admin can update dispatch_radius_km via PATCH /admin/config/fare"
    implemented: true
    working: true
    file: "/app/backend/app/routes/admin.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: false
        agent: "testing"
        comment: "BUG: PATCH /api/admin/config/fare {dispatch_radius_km: 10} returns 200 but the value is silently dropped — `dispatch_radius_km` is missing from ALLOWED_CFG_FIELDS."
      - working: true
        agent: "main"
        comment: "Fixed: added dispatch_radius_km to ALLOWED_CFG_FIELDS. Verified PATCH 5→8.5 reflected in subsequent GET. Reset to 5 default after test."

  - task: "Ratings & complaints (Phase 3)"
    implemented: true
    working: true
    file: "/app/backend/app/routes/ratings.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/rides/{id}/rate (1-5 stars + comment, idempotent — re-rating updates the row), GET /api/rides/{id}/ratings, POST /api/rides/{id}/complaint (9 categories), GET /api/users/{id}/rating, GET /api/admin/complaints (filterable by status), PATCH /api/admin/complaints/{id} resolve/reject. Aggregate rating auto-recomputed on user + driver doc."
      - working: true
        agent: "testing"
        comment: "Iter4 regression: POST /rides/{id}/rate with 5 stars returns rating doc; POST /rides/{id}/complaint creates complaint; GET /admin/complaints returns list with joined ride context."

  - task: "Admin reports — timeseries, leaderboard, top routes (Phase 3)"
    implemented: true
    working: true
    file: "/app/backend/app/routes/admin.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "GET /api/admin/reports/timeseries?days=N → per-day rides + revenue + cancellation. GET /api/admin/reports/leaderboard → top drivers by earnings (joined with user + driver doc, includes avg_rating). GET /api/admin/reports/top-routes → most popular pickup→drop pairs (local rides). open_complaints added to /api/admin/dashboard."
      - working: true
        agent: "testing"
        comment: "Iter4 regression: /admin/dashboard returns total_rides + active_drivers + open_complaints; /admin/reports/timeseries?days=7 returns 7-row series."

  - task: "Login OTP global mock 123456 for all phones (iter4 revert)"
    implemented: true
    working: true
    file: "/app/backend/app/routes/auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "send-otp returns dev_otp='123456' for admin 9999999999, driver 9000000001, passenger 9000000002, and brand-new phone. verify-otp with 123456 succeeds for all four. No more sticky/per-phone OTP variation — reverted as user clarified."

  - task: "Sticky per-passenger RIDE PIN (users.ride_pin)"
    implemented: true
    working: true
    file: "/app/backend/app/routes/auth.py and /app/backend/app/routes/rides.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Verified end-to-end: new passenger signup returns user.ride_pin=4-digit string (P1='4266'). Same passenger creates Ride#1,#2,#3 with different pickups/drops — every response.pin === P1 (NOT regenerated). Another passenger gets P2='4800' (distinct). PIN flow still works: driver accepts Ride#1, POST /rides/{id}/verify-pin {pin: P1} → 200, status='started'. Legacy back-fill verified — manually unsetting ride_pin via motor then re-login causes verify-otp to backfill a new sticky PIN ('9435'). Also backfilled at ride creation time if still missing (rides.py line 65-68)."

  - task: "Tip feature POST /api/rides/{id}/tip (10/20/50)"
    implemented: true
    working: true
    file: "/app/backend/app/routes/rides.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Validated all 7 acceptance criteria. F0=96.0 baseline → tip 10 → fare=106, tip=10, commission=10.6, driver_earning=95.4 (recomputed). tip 20 cumulative → fare=126, tip=30. tip 50 → fare=176, tip=80. tip 100 → 400. Tip by non-owner passenger → 404. Tip after driver accepts → 400 (only allowed in 'requested')."

  - task: "Name validation regex in verify-otp"
    implemented: true
    working: true
    file: "/app/backend/app/routes/auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Validated: name='Rohan9' → 400 with 'letters' in message; '@#$' → 400; valid 'Rohan Sharma' → 200 with access_token; no name field for new user → {requires_name:true, is_new_user:true} (200, OTP not consumed); legacy user (name unset via mongo) → requires_name=true with is_new_user=false."

  - task: "Passenger location streaming via WebSocket"
    implemented: true
    working: true
    file: "/app/backend/app/routes/ws.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Setup: passenger creates ride, driver accepts (status=accepted). Both connect WS (ws://localhost:8001/api/ws?token=<jwt>; preview wss still 307s). Passenger sends {type:'location',lat:27.5,lng:77.45}; driver receives {type:'passenger_location', ride_id, lat, lng} within <1s. GET /rides/{id} as driver afterwards returns passenger_location={lat,lng}. Persisted on the ride doc as passenger_lat/passenger_lng."

frontend:
  - task: "Map-based location picker (Leaflet + OSM)"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/MapPicker.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Cross-platform via WebView (iOS/Android) + iframe (web). Tap to pin, drag to refine, search bar, 'use my current location'. Auto reverse-geocode. Polyline rendered when route fetched. Verified rendering in web preview screenshot."
      - working: "NA"
        agent: "main"
        comment: "BUGFIX: iframe (web preview) was missing window.addEventListener('message') in Leaflet HTML, so setMode/setPickup/setDrop calls from RN never reached the iframe map. Added the listener — drop pin selection now works in web preview."

  - task: "Search-first LocationSearchSheet (Ola/Uber UX)"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/LocationSearchSheet.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "New full-screen sheet for pickup/drop selection. Search-first with 350ms debounced live autocomplete via Nominatim. Shows saved landmarks + filters as user types. 'Use current location' via expo-location. 'Pick on map' opens MapPicker for tap-to-pin. Verified UI rendering with screenshots."

  - task: "Service screen with new search UX + 24h schedule"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(passenger)/service.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Refactored to use LocationSearchSheet for both pickup AND drop. Inline route preview map only shown after both selected, with OSRM road polyline. SchedulePicker supports up to 24 hours ahead with Today/Tomorrow chips, +/-30m/+1h/+3h/+6h buttons, and native datetime input on web."

  - task: "First-time signup name screen"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/otp.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "After OTP verify, if backend returns requires_name, OTP screen switches to a name-entry step. Re-submits with name to complete auth."

  - task: "Scrollable login/otp/role-select"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/{login,otp,role-select}.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Wrapped all three pre-auth screens in ScrollView with keyboardShouldPersistTaps. Verified visible on 390x844 viewport."

  - task: "Admin landmarks management UI"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(admin)/fares.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Converted Fares screen into tabbed Config screen with Fares + Landmarks tabs. Landmarks tab: list, add, edit, delete via modal sheet."

metadata:
  created_by: "main_agent"
  version: "1.3"
  test_sequence: 4
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "testing"
    message: |
      Iter4 backend validation COMPLETE — 41/42 PASS. Test script: /app/backend_test_iter4.py.

      ✅ A) Login OTP reverted to global mock 123456 — send-otp + verify-otp work for admin (9999999999), driver (9000000001), passenger (9000000002), and brand-new phones. No sticky/phone-specific OTP behaviour remains.
      ✅ B) Sticky per-passenger RIDE PIN — signup returns user.ride_pin (4 digits, P1). 3 successive rides with different pickups all return ride.pin === P1 (NOT regenerated). Different passenger gets distinct P2. verify-pin flow works (driver accepts → POST /rides/{id}/verify-pin {pin:P1} → 200, status='started'). Legacy back-fill verified via motor: unset ride_pin then re-login → verify-otp inserts a fresh sticky PIN. Also back-filled at ride creation time in rides.py:65-68.
      ✅ C) Name validation — 'Rohan9' → 400 with 'letters' message; '@#$' → 400; 'Rohan Sharma' → 200 with token; no name field → {requires_name:true, is_new_user:true} (OTP not consumed); legacy user (name unset) → requires_name=true with is_new_user=false.
      ✅ D) Tip feature — Baseline F0=96. tip 10 → fare=106, tip=10, commission/driver_earning recomputed. tip 20 cumulative → fare=126, tip=30. tip 50 → fare=176, tip=80. tip 100 → 400. Non-owner passenger → 404. After driver accepts → 400 (state guard).
      ✅ E) Passenger location WS — passenger sends {type:'location',lat:27.5,lng:77.45}; driver receives {type:'passenger_location', ride_id, lat, lng} <1s. Persisted on ride doc (passenger_lat/lng); GET /rides/{id} as driver returns passenger_location.
      ✅ F) Regression — WS dispatch (ride_requested), accept (ride_accepted + ride_taken), driver location forwarding (driver_location), ratings, complaints (create + admin list), /admin/dashboard, /admin/reports/timeseries — ALL PASS.

      ⚠️ MINOR (NOT a backend bug):
      /api/geo/search?q=govardhan returned `{results: []}` because upstream nominatim.openstreetmap.org is returning HTTP 429 to this datacenter IP (public OSM Nominatim rate-limit policy for shared cloud IPs). Backend correctly catches the exception and returns the documented empty-list fallback. /api/geo/route OSRM still works (returned distance_km=4.98, 166-point polyline). Recommendation for production: self-host nominatim, use Photon, or switch to Google provider (already a code path).

      NOTE on testing infra:
      - REST: preview URL `https://govardhan-erickshaw.preview.emergentagent.com/api` returns 307 to `.internal.preview.emergentagent.com`, and httpx (with follow_redirects=True) drops Authorization header on cross-origin hops. Test script hits the internal preview URL directly to avoid the redirect. Functionality is identical.
      - WebSocket: preview wss still 307s — using ws://localhost:8001/api/ws?token=<jwt> as before. Mobile/production clients via wss://preview should still work assuming ingress nginx has Upgrade headers (previous note from phase-2 testing applies).

  - agent: "main"
    message: |
      Iteration 4 — please validate the following backend behaviour (login OTP is back to global mock 123456 for ALL phones; the user clarified that "sticky OTP" was meant for ride PIN, not login OTP):
      
      1) Sticky per-passenger RIDE PIN
         - Brand new passenger signup: verify-otp creates user, response includes user.ride_pin = some 4-digit string. Save P1.
         - Same passenger creates 3 rides → every ride.pin must equal P1 (NOT a fresh one).
         - Verify pin on ride 2 / ride 3 using P1 — should succeed.
         - Different passenger has a different ride_pin.
         - Legacy account (no ride_pin in db) — after they login once, ride_pin gets backfilled.
      
      2) Login OTP returned to mock `123456` for ALL phones (admin + non-admin). Just confirm send-otp returns `dev_otp: "123456"` for any phone.
      
      3) Name validation (still active)
         - verify-otp with name "Rohan9" → 400
         - verify-otp with name "@#$" → 400
         - verify-otp with name "Rohan Sharma" → 200
      
      4) Tip feature (rides.py)
         - Passenger creates a ride → status = requested
         - POST /api/rides/{id}/tip {amount: 10} → fare goes up by 10, ride.tip = 10
         - amount 20 again → fare goes up by 20, ride.tip = 30
         - amount 100 → 400
         - After driver accepts → tip endpoint returns 400
      
      5) Passenger location streaming (ws.py)
         - Passenger has active accepted ride
         - Passenger sends {type:"location", lat, lng} via WS
         - Driver WS receives {type:"passenger_location", ride_id, lat, lng}
         - GET /api/rides/{id} as driver includes passenger_location field
      
      Regression: existing flows from phase 1/2/3 should still pass (geo, ratings, complaints, dashboard charts, WS dispatch, push tokens, ride lifecycle).
      
      Test credentials: /app/memory/test_credentials.md (login OTP for ALL phones = 123456).

  - agent: "testing"
    message: |
      Iteration 4 backend validation — 41/42 PASS. /app/backend_test_iter4.py created.
      
      A) Login OTP mock 123456 — ✅ admin/driver/passenger/new phones all return `dev_otp:"123456"`; verify with 123456 succeeds.
      B) Sticky per-passenger ride PIN — ✅ Signup returns user.ride_pin (P1). 3 successive rides keep pin === P1. Different passenger gets different PIN. PIN flow works (verify-pin(P1) starts ride). Legacy backfill verified via motor (unset → re-login backfills).
      C) Name validation — ✅ "Rohan9" → 400 with "letters"; "@#$" → 400; "Rohan Sharma" → 200; no name → requires_name:true (OTP not consumed); legacy user without name → requires_name:true.
      D) Tip feature — ✅ Baseline F0=96. Cumulative tip 10/20/50: fare 106→126→176, tip 10→30→80, commission/driver_earning recomputed. tip 100 → 400. Non-owner → 404. After accept → 400.
      E) Passenger WS location — ✅ Forwarded to driver in <1s with ride_id. GET /rides/{id} as driver returns passenger_location persisted on ride doc.
      F) Regression — ✅ ride_requested/accepted/taken broadcast, driver_location, /geo/route polyline (166pts, 4.98km), ratings, complaints CRUD, admin dashboard + timeseries.
      
      ONLY ISSUE (non-blocking, upstream): /api/geo/search?q=govardhan returns empty because Nominatim rate-limits the cloud datacenter IP with HTTP 429. Backend gracefully returns empty array (correct fallback). For production: self-host Nominatim, switch to Photon/Google.

agent_communication:
  - agent: "main"
    message: |
      Phase 1 implemented. Major changes:
      
      BACKEND (needs full retest of existing + new routes):
      - Refactored server.py (684→64 lines). Routes now in app/routes/{auth,users,config,drivers,rides,suggestions,admin,geo}.py
      - NEW: /api/geo/{region,search,reverse,route} — proxies Nominatim + OSRM (free).
      - CHANGED: /api/auth/verify-otp — now requires `name` for new users (returns {requires_name: true} otherwise).
      - NEW: /api/admin/landmarks GET/POST/PATCH/DELETE for landmark management.
      - All other existing routes (paths) unchanged.
      
      Please run the existing test_tirthride_api.py suite + verify:
      1. /api/geo/route returns distance_km > 0 with valid polyline for Govardhan coords
      2. /api/geo/search returns results for "radha kund" or "govardhan"
      3. /api/auth/verify-otp with new phone + no name returns {requires_name: true}
      4. /api/auth/verify-otp with new phone + name creates user and returns access_token
      5. /api/admin/landmarks CRUD as admin
      
      Test credentials in /app/memory/test_credentials.md.

  - agent: "testing"
    message: |
      Phase 2 backend validation complete. 36/37 checks PASS. See /app/backend_test_phase2.py.
      
      ✅ WebSocket auth (invalid/valid) + hello + ping/pong
      ✅ Realtime ride dispatch — both online drivers (no current_lat/lng) got `ride_requested`; A accepts → B gets `ride_taken`, passenger gets `ride_accepted` w/ driver info
      ✅ Targeted dispatch — Driver A (in 5km) got event, Driver B (~100km away) did NOT; ride still created status=requested,driver_id=null
      ✅ Driver location — POST /drivers/location persists lat/lng; GET /rides/{id} (passenger) returns driver_location; WS {type:'location'} from driver → passenger gets {type:'driver_location', ride_id, lat, lng}
      ✅ Push token — POST /users/push-token stores token; non-Expo tokens accepted gracefully and skipped at send time (no exp.host call) [Expo Push delivery itself is MOCKED — only verified storage + filter logic]
      ✅ Ride lifecycle WS — ride_started, ride_completed (with fare), ride_cancelled (by=passenger, reason) all delivered
      ✅ Config — GET /config/fare returns both `dispatch_radius_km` (5.0) and `surge_pct` (0.0)
      ✅ Phase 1 regression — /, /geo/*, /admin/landmarks all green
      
      ❌ ONE BUG FOUND (high priority):
      PATCH /api/admin/config/fare {"dispatch_radius_km": 10} returns 200 but the value is silently dropped. Root cause: `dispatch_radius_km` is missing from `ALLOWED_CFG_FIELDS` in /app/backend/app/routes/admin.py (line 15-20). After PATCH, GET /config/fare still shows 5.0. FIX: add 'dispatch_radius_km' to the set — one-line change. This blocks Phase 2 spec requirement of admin tuning dispatch radius at runtime.
      
      NOTE on WebSocket via preview URL:
      The preview HTTPS ingress responds to the WebSocket upgrade with HTTP 307 redirecting to https://...internal.preview.emergentagent.com which the `websockets` client rejects (not a ws:// scheme). REST works fine on the preview URL. WS works fine on ws://localhost:8001/api/ws. Mobile clients using EXPO_PUBLIC_BACKEND_URL → wss should ideally also work if the production ingress has `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"`. Main agent: please verify ingress nginx config has WS upgrade support so mobile/web clients can reach WS through preview URL.
      
      Detailed test code: /app/backend_test_phase2.py (also /app/backend_test.py for Phase 1 regression).