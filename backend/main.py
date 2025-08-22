import queue
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import math
from collections import deque

app = FastAPI(title="Ride Dispatch System", version="1.0.0")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class Location(BaseModel):
    x: int
    y: int

class Driver(BaseModel):
    id: str
    location: Location
    status: str = "available"  # available, on_trip, offline

class Rider(BaseModel):
    id: str
    pickup_location: Location
    dropoff_location: Location

class RideRequest(BaseModel):
    rider_id: str
    pickup_location: Location
    dropoff_location: Location
    status: str = "waiting"  # waiting, assigned, rejected, completed, failed
    drivers_rejected: set
    assigned_driver: Optional[str] = None
    current_phase: str = "to_pickup"  # to_pickup, to_dropoff, completed

class AddDriverRequest(BaseModel):
    id: str
    x: int
    y: int

class AddRiderRequest(BaseModel):
    id: str
    x: int
    y: int

class DeleteDriverRequest(BaseModel):
    id: str

class DeleteRiderRequest(BaseModel):
    id: str

class AddRideRequest(BaseModel):
    rider_id: str
    dropoff_x: int
    dropoff_y: int
    did_driver_accept: Optional[bool] = None
    driver_id: Optional[str] = None

# In-memory storage
drivers = {}
driver_locations = {}
riders = {}
ride_requests = {}
current_tick = 0

def find_next_available_driver(pickup_location, drivers_rejected):
    """Find the next closest available driver that hasn't been rejected"""
    queue = deque()
    queue.append((pickup_location.x, pickup_location.y, 0))
    dirs = [(1,0), (-1,0), (0,1), (0,-1)]
    locations_visited = set()
    locations_visited.add((pickup_location.x, pickup_location.y))
    
    while queue:
        x, y, distance = queue.popleft()
        
        if (x, y) in driver_locations:
            for driver_id in driver_locations[(x, y)]:
                if (drivers[driver_id].status == "available" and 
                    driver_id not in drivers_rejected):
                    return driver_id, distance
        
        # Explore neighboring cells
        for dx, dy in dirs:
            new_x, new_y = x + dx, y + dy
            if (0 <= new_x <= 99 and 0 <= new_y <= 99 and 
                (new_x, new_y) not in locations_visited):
                locations_visited.add((new_x, new_y))
                queue.append((new_x, new_y, distance + 1))
    
    return None, None

def handle_driver_response(request: AddRideRequest):
    """Handle driver acceptance/rejection of a ride request"""
    try:
        if request.rider_id not in ride_requests:
            return {"status": "error", "message": f"Ride request for rider {request.rider_id} not found"}
        
        if request.driver_id not in drivers:
            return {"status": "error", "message": f"Driver {request.driver_id} not found"}
        
        ride_request = ride_requests[request.rider_id]
        
        if request.did_driver_accept:
            # Driver accepted the ride
            drivers[request.driver_id].status = "on_trip"
            ride_request.status = "assigned"
            ride_request.assigned_driver = request.driver_id
            return {
                "status": "success",
                "message": f"Driver {request.driver_id} accepted the ride for rider {request.rider_id}"
            }
        else:
            # Driver rejected the ride - try to find another driver
            ride_request.drivers_rejected.add(request.driver_id)
            
            # Find next available driver
            next_driver, distance = find_next_available_driver(
                ride_request.pickup_location, 
                ride_request.drivers_rejected
            )
            
            if next_driver:
                # Found another driver to try
                return {
                    "status": "success",
                    "message": f"Driver {request.driver_id} rejected. Trying driver {next_driver}.",
                    "driver_selected": next_driver
                }
            else:
                # No more available drivers - remove the ride request
                del ride_requests[request.rider_id]
                return {
                    "status": "error",
                    "message": f"All available drivers rejected the ride for rider {request.rider_id}. Ride request cancelled."
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def read_root():
    return {"message": "Ride Dispatch System API"}

@app.post("/add_driver")
def add_driver(request: AddDriverRequest):
    """Add a new driver to the system"""
    try:
        # Validate coordinates
        if not (0 <= request.x <= 99 and 0 <= request.y <= 99):
            raise HTTPException(status_code=400, detail="Coordinates must be between 0 and 99")

        if request.id in drivers:
            drivers[request.id].location.x = request.x
            drivers[request.id].location.y = request.y
        else:
            drivers[request.id] = Driver(id=request.id, location=Location(x=request.x, y=request.y))
        
        loc_tuple = (request.x, request.y)
        if loc_tuple not in driver_locations:
            driver_locations[loc_tuple] = []
        driver_locations[loc_tuple].append(request.id)
        
        # For now, just return success
        return {"status": "success", "message": f"Driver {request.id} added at ({request.x}, {request.y})"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/add_rider")
def add_rider(request: AddRiderRequest):
    """Add a new rider to the system"""
    try:
        # Validate coordinates
        if not (0 <= request.x <= 99 and 0 <= request.y <= 99):
            raise HTTPException(status_code=400, detail="Coordinates must be between 0 and 99")
        
        # For now, create a simple rider with pickup and dropoff at same location
        # In a real system, you'd want separate pickup and dropoff coordinates
        location = Location(x=request.x, y=request.y)
        riders[request.id] = Rider(
            id=request.id, 
            pickup_location=location,
            dropoff_location=location
        )
        
        return {"status": "success", "message": f"Rider {request.id} added at ({request.x}, {request.y})"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/delete_driver")
def delete_driver(request: DeleteDriverRequest):
    """Remove a driver from the system"""
    try:
        if request.id in drivers:
            # Remove from driver_locations mapping
            driver_location = (drivers[request.id].location.x, drivers[request.id].location.y)
            if driver_location in driver_locations:
                driver_locations[driver_location].remove(request.id)
                if not driver_locations[driver_location]:  # If no more drivers at this location
                    del driver_locations[driver_location]
            
            del drivers[request.id]
            return {"status": "success", "message": f"Driver {request.id} removed"}
        else:
            return {"status": "error", "message": f"Driver {request.id} not found"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/delete_rider")
def delete_rider(request: DeleteRiderRequest):
    """Remove a rider from the system"""
    try:
        if request.id in riders:
            del riders[request.id]
            return {"status": "success", "message": f"Rider {request.id} removed"}
        else:
            return {"status": "error", "message": f"Rider {request.id} not found"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/add_ride")
def add_ride(request: AddRideRequest):
    """Request a new ride"""
    try:
        # If this is a driver response (acceptance/rejection)
        if request.did_driver_accept is not None and request.driver_id is not None:
            return handle_driver_response(request)
        
        # Initial ride request - validate coordinates
        if not (0 <= request.dropoff_x <= 99 and 0 <= request.dropoff_y <= 99):
            raise HTTPException(status_code=400, detail="Dropoff coordinates must be between 0 and 99")
        
        # Check if rider exists
        if request.rider_id not in riders:
            raise HTTPException(status_code=400, detail=f"Rider {request.rider_id} not found")
        
        # Create ride request
        pickup_location = riders[request.rider_id].pickup_location
        dropoff_location = Location(x=request.dropoff_x, y=request.dropoff_y)

        # BFS to find closest available driver
        queue = deque()
        queue.append((pickup_location.x, pickup_location.y, 0))
        dirs = [(1,0), (-1,0), (0,1), (0,-1)]
        locations_visited = set()
        locations_visited.add((pickup_location.x, pickup_location.y))
        closest_driver = None
        
        while queue:
            x, y, distance = queue.popleft()
            
            if (x, y) in driver_locations:
                for driver_id in driver_locations[(x, y)]:
                    if drivers[driver_id].status == "available":
                        closest_driver = driver_id
                        break
                if closest_driver:
                    break
            
            # If we haven't found a driver yet, explore neighboring cells
            for dx, dy in dirs:
                new_x, new_y = x + dx, y + dy
                # Check bounds
                if 0 <= new_x <= 99 and 0 <= new_y <= 99 and (new_x, new_y) not in locations_visited:
                    locations_visited.add((new_x, new_y))
                    queue.append((new_x, new_y, distance + 1))
        
        if not closest_driver:
            return {
                "status": "error", 
                "message": f"No available drivers found for rider {request.rider_id}"
            }

        # Create ride request
        ride_requests[request.rider_id] = RideRequest(
            rider_id=request.rider_id,
            pickup_location=pickup_location,
            dropoff_location=dropoff_location,
            drivers_rejected=set(),
        )
        
        return {
            "status": "success", 
            "message": f"Driver {closest_driver} found. Checking if they want to accept.",
            "driver_selected": closest_driver
        }
       
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def move_driver_towards_target(driver_id, target_x, target_y):
    """Move driver one step towards the target location"""
    driver = drivers[driver_id]
    current_x, current_y = driver.location.x, driver.location.y
    
    # Calculate direction to move
    dx = 0
    dy = 0
    
    if current_x < target_x:
        dx = 1
    elif current_x > target_x:
        dx = -1
    
    if current_y < target_y:
        dy = 1
    elif current_y > target_y:
        dy = -1
    
    # Update driver location
    new_x = max(0, min(99, current_x + dx))
    new_y = max(0, min(99, current_y + dy))
    
    # Update driver_locations mapping
    old_location = (current_x, current_y)
    new_location = (new_x, new_y)
    
    if old_location in driver_locations:
        driver_locations[old_location].remove(driver_id)
        if not driver_locations[old_location]:
            del driver_locations[old_location]
    
    if new_location not in driver_locations:
        driver_locations[new_location] = []
    driver_locations[new_location].append(driver_id)
    
    # Update driver location
    driver.location.x = new_x
    driver.location.y = new_y
    
    return new_x, new_y

@app.post("/tick")
def tick():
    """Advance simulation time by one tick"""
    try:
        global current_tick
        current_tick += 1
        
        # Process all assigned rides
        completed_rides = []
        for rider_id, ride_request in ride_requests.items():
            if ride_request.status == "assigned" and ride_request.assigned_driver:
                driver_id = ride_request.assigned_driver
                
                if ride_request.current_phase == "to_pickup":
                    # Move towards pickup location
                    pickup_x = ride_request.pickup_location.x
                    pickup_y = ride_request.pickup_location.y
                    
                    new_x, new_y = move_driver_towards_target(driver_id, pickup_x, pickup_y)
                    
                    # Check if we've reached pickup location
                    if new_x == pickup_x and new_y == pickup_y:
                        ride_request.current_phase = "to_dropoff"
                
                elif ride_request.current_phase == "to_dropoff":
                    # Move towards dropoff location
                    dropoff_x = ride_request.dropoff_location.x
                    dropoff_y = ride_request.dropoff_location.y
                    
                    new_x, new_y = move_driver_towards_target(driver_id, dropoff_x, dropoff_y)
                    
                    # Check if we've reached dropoff location
                    if new_x == dropoff_x and new_y == dropoff_y:
                        ride_request.current_phase = "completed"
                        ride_request.status = "completed"
                        drivers[driver_id].status = "available"
                        
                        # Update rider location to dropoff location
                        if ride_request.rider_id in riders:
                            riders[ride_request.rider_id].pickup_location.x = dropoff_x
                            riders[ride_request.rider_id].pickup_location.y = dropoff_y
                            riders[ride_request.rider_id].dropoff_location.x = dropoff_x
                            riders[ride_request.rider_id].dropoff_location.y = dropoff_y
                        
                        completed_rides.append(rider_id)
        
        # Remove completed rides
        for rider_id in completed_rides:
            del ride_requests[rider_id]
        
        return {
            "status": "success", 
            "message": f"Advanced to tick {current_tick}. Processed {len(ride_requests)} active rides."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/state")
def get_state():
    """Get current system state"""
    return {
        "drivers": list(drivers.values()),
        "riders": list(riders.values()),
        "ride_requests": list(ride_requests.values()),
        "current_tick": current_tick
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
