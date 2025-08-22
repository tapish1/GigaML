# Ride Dispatch System

A simplified ride-hailing backend system using FastAPI with a React frontend to visualize and simulate the system.


## How to Run
First run ./run.sh then ./setup.sh



## Dispatch Logic

Used bfs based on euclidin distance to get the the closest driver. If that driver is not available or rejects a ride, it trys the second closest and so on. If all drivers are busy or reject then no ride is set. Drivers take the shortest path to the rider and dropoff location