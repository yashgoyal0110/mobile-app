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
    working: "NA"
    file: "/app/backend/server.py and /app/backend/app/routes/*"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Split 684-line server.py into modular routers under app/routes/. server.py is now 64-line entry point. All existing routes preserved with same paths."

  - task: "Geo proxy endpoints (/api/geo/search, /reverse, /route, /region)"
    implemented: true
    working: "NA"
    file: "/app/backend/app/routes/geo.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added Nominatim (search/reverse) + OSRM (routing) proxy. Bounded to Govardhan bbox. Provider swappable via GEO_PROVIDER env var. Verified locally: route returns real road distance with polyline."

  - task: "First-time signup with name collection"
    implemented: true
    working: "NA"
    file: "/app/backend/app/routes/auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "verify-otp now returns {requires_name: true} if user is new (or legacy without name) and no name in payload. Frontend collects name and re-submits."

  - task: "Admin landmarks CRUD"
    implemented: true
    working: "NA"
    file: "/app/backend/app/routes/admin.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added GET /admin/landmarks, POST, PATCH, DELETE for landmark management within fare config."

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
    - "Modular backend refactor (auth, users, config, drivers, rides, suggestions, admin, geo)"
    - "Geo proxy endpoints (/api/geo/search, /reverse, /route, /region)"
    - "First-time signup with name collection"
    - "Admin landmarks CRUD"
  stuck_tasks: []
  test_all: true
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