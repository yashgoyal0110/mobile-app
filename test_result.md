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
    working: "NA"
    file: "/app/backend/app/routes/ratings.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/rides/{id}/rate (1-5 stars + comment, idempotent — re-rating updates the row), GET /api/rides/{id}/ratings, POST /api/rides/{id}/complaint (9 categories), GET /api/users/{id}/rating, GET /api/admin/complaints (filterable by status), PATCH /api/admin/complaints/{id} resolve/reject. Aggregate rating auto-recomputed on user + driver doc."

  - task: "Admin reports — timeseries, leaderboard, top routes (Phase 3)"
    implemented: true
    working: "NA"
    file: "/app/backend/app/routes/admin.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "GET /api/admin/reports/timeseries?days=N → per-day rides + revenue + cancellation. GET /api/admin/reports/leaderboard → top drivers by earnings (joined with user + driver doc, includes avg_rating). GET /api/admin/reports/top-routes → most popular pickup→drop pairs (local rides). open_complaints added to /api/admin/dashboard."

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
  version: "1.1"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus:
    - "Admin can update dispatch_radius_km via PATCH /admin/config/fare"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

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