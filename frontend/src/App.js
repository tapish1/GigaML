import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

function App() {
  const [drivers, setDrivers] = useState([]);
  const [riders, setRiders] = useState([]);
  const [currentTick, setCurrentTick] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [rideRequests, setRideRequests] = useState([]);

  // Form states
  const [driverForm, setDriverForm] = useState({ id: '', x: '', y: '' });
  const [riderForm, setRiderForm] = useState({ id: '', x: '', y: '' });
  const [rideForm, setRideForm] = useState({ rider_id: '', dropoff_x: '', dropoff_y: '' });
  const [deleteDriverId, setDeleteDriverId] = useState('');
  const [deleteRiderId, setDeleteRiderId] = useState('');
  const [showDriverPopup, setShowDriverPopup] = useState(false);
  const [pendingRide, setPendingRide] = useState(null);
  const [isRetryDriver, setIsRetryDriver] = useState(false);

  // API base URL
  const API_BASE = 'http://localhost:8000';

  // Helper function to make API calls
  const apiCall = async (endpoint, method = 'GET', data = null) => {
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };
      
      if (data) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(`${API_BASE}${endpoint}`, options);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.detail || 'API call failed');
      }
      
      return result;
    } catch (error) {
      throw error;
    }
  };

  // Function to fetch current state
  const fetchState = useCallback(async () => {
    try {
      const state = await apiCall('/state');
      setDrivers(state.drivers || []);
      setRiders(state.riders || []);
      setRideRequests(state.ride_requests || []);
      setCurrentTick(state.current_tick || 0);
    } catch (error) {
      console.error('Failed to fetch state:', error);
    }
  }, []);

  // Fetch initial state when component mounts
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Add driver
  const handleAddDriver = async (e) => {
    e.preventDefault();
    try {
      const result = await apiCall('/add_driver', 'POST', {
        id: driverForm.id,
        x: parseInt(driverForm.x),
        y: parseInt(driverForm.y)
      });
      
      setMessage(result.message);
      setDriverForm({ id: '', x: '', y: '' });
      setError('');
      await fetchState(); // Update state after adding driver
    } catch (err) {
      setError(err.message);
      setMessage('');
    }
  };

  // Add rider
  const handleAddRider = async (e) => {
    e.preventDefault();
    try {
      const result = await apiCall('/add_rider', 'POST', {
        id: riderForm.id,
        x: parseInt(riderForm.x),
        y: parseInt(riderForm.y)
      });
      
      setMessage(result.message);
      setRiderForm({ id: '', x: '', y: '' });
      setError('');
      await fetchState(); // Update state after adding rider
    } catch (err) {
      setError(err.message);
      setMessage('');
    }
  };

  // Delete driver
  const handleDeleteDriver = async (e) => {
    e.preventDefault();
    try {
      const result = await apiCall('/delete_driver', 'POST', {
        id: deleteDriverId
      });
      
      setMessage(result.message);
      setDeleteDriverId('');
      setError('');
      await fetchState(); // Update state after deleting driver
    } catch (err) {
      setError(err.message);
      setMessage('');
    }
  };

  // Delete rider
  const handleDeleteRider = async (e) => {
    e.preventDefault();
    try {
      const result = await apiCall('/delete_rider', 'POST', {
        id: deleteRiderId
      });
      
      setMessage(result.message);
      setDeleteRiderId('');
      setError('');
      await fetchState(); // Update state after deleting rider
    } catch (err) {
      setError(err.message);
      setMessage('');
    }
  };

  // Add ride
  const handleAddRide = async (e) => {
    e.preventDefault();
    try {
      const result = await apiCall('/add_ride', 'POST', {
        rider_id: rideForm.rider_id,
        dropoff_x: parseInt(rideForm.dropoff_x),
        dropoff_y: parseInt(rideForm.dropoff_y)
      });
      
      if (result.status === 'success' && result.driver_selected) {
        // Show driver acceptance popup
        setPendingRide({
          rider_id: rideForm.rider_id,
          dropoff_x: parseInt(rideForm.dropoff_x),
          dropoff_y: parseInt(rideForm.dropoff_y),
          driver_id: result.driver_selected
        });
        setShowDriverPopup(true);
        setIsRetryDriver(false);
        setMessage(result.message);
      } else {
        setMessage(result.message);
        setRideForm({ rider_id: '', dropoff_x: '', dropoff_y: '' });
      }
      setError('');
    } catch (err) {
      setError(err.message);
      setMessage('');
    }
  };

  // Handle driver acceptance/rejection
  const handleDriverResponse = async (accepted) => {
    try {
      const result = await apiCall('/add_ride', 'POST', {
        rider_id: pendingRide.rider_id,
        dropoff_x: pendingRide.dropoff_x,
        dropoff_y: pendingRide.dropoff_y,
        driver_id: pendingRide.driver_id,
        did_driver_accept: accepted
      });
      
      if (result.status === 'success' && result.driver_selected) {
        // Another driver was found after rejection
        setPendingRide({
          ...pendingRide,
          driver_id: result.driver_selected
        });
        setIsRetryDriver(true);
        setMessage(result.message);
        // Keep popup open for the new driver
      } else if (result.status === 'success') {
        // Driver accepted or ride was cancelled
        setMessage(result.message);
        setShowDriverPopup(false);
        setPendingRide(null);
        setIsRetryDriver(false);
        setRideForm({ rider_id: '', dropoff_x: '', dropoff_y: '' });
        await fetchState(); // Update state after ride assignment
      } else {
        // Error occurred
        setMessage(result.message);
        setShowDriverPopup(false);
        setPendingRide(null);
        setIsRetryDriver(false);
        setRideForm({ rider_id: '', dropoff_x: '', dropoff_y: '' });
      }
      setError('');
    } catch (err) {
      setError(err.message);
      setMessage('');
      setShowDriverPopup(false);
      setPendingRide(null);
      setIsRetryDriver(false);
    }
  };

  // Next tick
  const handleTick = async () => {
    try {
      const result = await apiCall('/tick', 'POST');
      setMessage(result.message);
      setError('');
      await fetchState(); // Update state after tick
    } catch (err) {
      setError(err.message);
      setMessage('');
    }
  };

  // Get cell class based on position
  const getCellClass = (x, y) => {
    const isDriver = drivers.some(driver => driver.location.x === x && driver.location.y === y);
    
    // Check if this is a pickup or dropoff location for active rides
    const isPickupLocation = rideRequests.some(ride => 
      ride.pickup_location.x === x && ride.pickup_location.y === y && ride.status === 'assigned'
    );
    const isDropoffLocation = rideRequests.some(ride => 
      ride.dropoff_location.x === x && ride.dropoff_location.y === y && ride.status === 'assigned'
    );
    
    // Show rider at dropoff location when driver is heading there
    const isRiderAtDropoff = rideRequests.some(ride => 
      ride.dropoff_location.x === x && ride.dropoff_location.y === y && 
      ride.status === 'assigned' && ride.current_phase === 'to_dropoff'
    );
    
    // Show rider at their current location (pickup or dropoff)
    const isRiderAtLocation = riders.some(rider => 
      rider.pickup_location.x === x && rider.pickup_location.y === y
    );
    
    if (isDriver) return 'grid-cell driver';
    if (isRiderAtDropoff || isRiderAtLocation) return 'grid-cell rider';
    if (isPickupLocation) return 'grid-cell pickup';
    if (isDropoffLocation) return 'grid-cell dropoff';
    return 'grid-cell';
  };

  // Generate grid cells
  const renderGrid = () => {
    const cells = [];
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        cells.push(
          <div
            key={`${x}-${y}`}
            className={getCellClass(x, y)}
            title={`(${x}, ${y})`}
          />
        );
      }
    }
    return cells;
  };

  return (
    <div className="app">
      <div className="grid-container">
        <h2>Ride Dispatch System - 100x100 Grid</h2>
        <div className="grid">
          {renderGrid()}
        </div>
        <div className="status">
          <h4>System Status</h4>
          <p>Current Tick: {currentTick}</p>
          <p>Drivers: {drivers.length}</p>
          <p>Riders: {riders.length}</p>
          <p>Active Rides: {rideRequests.filter(ride => ride.status === 'assigned').length}</p>
          {rideRequests.filter(ride => ride.status === 'assigned').map(ride => (
            <div key={ride.rider_id} style={{marginTop: '10px', padding: '5px', background: '#f0f0f0', borderRadius: '4px'}}>
              <small>
                <strong>Ride {ride.rider_id}:</strong> Driver {ride.assigned_driver} - {ride.current_phase}
              </small>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar">
        <h2>Controls</h2>
        
        {message && <div className="success">{message}</div>}
        {error && <div className="error">{error}</div>}

        {/* Add Driver Section */}
        <div className="section">
          <h3>Add Driver</h3>
          <form onSubmit={handleAddDriver}>
            <div className="form-group">
              <label>Driver ID:</label>
              <input
                type="text"
                value={driverForm.id}
                onChange={(e) => setDriverForm({...driverForm, id: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>X Coordinate (0-99):</label>
              <input
                type="number"
                min="0"
                max="99"
                value={driverForm.x}
                onChange={(e) => setDriverForm({...driverForm, x: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>Y Coordinate (0-99):</label>
              <input
                type="number"
                min="0"
                max="99"
                value={driverForm.y}
                onChange={(e) => setDriverForm({...driverForm, y: e.target.value})}
                required
              />
            </div>
            <button type="submit" className="btn btn-success">Add Driver</button>
          </form>
        </div>

        {/* Add Rider Section */}
        <div className="section">
          <h3>Add Rider</h3>
          <form onSubmit={handleAddRider}>
            <div className="form-group">
              <label>Rider ID:</label>
              <input
                type="text"
                value={riderForm.id}
                onChange={(e) => setRiderForm({...riderForm, id: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>X Coordinate (0-99):</label>
              <input
                type="number"
                min="0"
                max="99"
                value={riderForm.x}
                onChange={(e) => setRiderForm({...riderForm, x: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>Y Coordinate (0-99):</label>
              <input
                type="number"
                min="0"
                max="99"
                value={riderForm.y}
                onChange={(e) => setRiderForm({...riderForm, y: e.target.value})}
                required
              />
            </div>
            <button type="submit" className="btn btn-success">Add Rider</button>
          </form>
        </div>

        {/* Delete Driver Section */}
        <div className="section">
          <h3>Delete Driver</h3>
          <form onSubmit={handleDeleteDriver}>
            <div className="form-group">
              <label>Driver ID:</label>
              <input
                type="text"
                value={deleteDriverId}
                onChange={(e) => setDeleteDriverId(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-danger">Delete Driver</button>
          </form>
        </div>

        {/* Delete Rider Section */}
        <div className="section">
          <h3>Delete Rider</h3>
          <form onSubmit={handleDeleteRider}>
            <div className="form-group">
              <label>Rider ID:</label>
              <input
                type="text"
                value={deleteRiderId}
                onChange={(e) => setDeleteRiderId(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-danger">Delete Rider</button>
          </form>
        </div>

        {/* Request Ride Section */}
        <div className="section">
          <h3>Request Ride</h3>
          <form onSubmit={handleAddRide}>
            <div className="form-group">
              <label>Rider ID:</label>
              <input
                type="text"
                value={rideForm.rider_id}
                onChange={(e) => setRideForm({...rideForm, rider_id: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>Dropoff X Coordinate (0-99):</label>
              <input
                type="number"
                min="0"
                max="99"
                value={rideForm.dropoff_x}
                onChange={(e) => setRideForm({...rideForm, dropoff_x: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>Dropoff Y Coordinate (0-99):</label>
              <input
                type="number"
                min="0"
                max="99"
                value={rideForm.dropoff_y}
                onChange={(e) => setRideForm({...rideForm, dropoff_y: e.target.value})}
                required
              />
            </div>
            <button type="submit" className="btn btn-success">Request Ride</button>
          </form>
        </div>

        {/* Next Tick Section */}
        <div className="section">
          <h3>Simulation Control</h3>
          <button onClick={handleTick} className="btn btn-success">
            Next Tick
          </button>
        </div>
      </div>

      {/* Driver Acceptance Popup */}
      {showDriverPopup && (
        <div className="popup-overlay">
          <div className="popup">
            <h3>Driver Assignment</h3>
            {isRetryDriver ? (
              <p>Previous driver rejected. Driver {pendingRide.driver_id} is now available.</p>
            ) : (
              <p>Driver {pendingRide.driver_id} has been selected for your ride.</p>
            )}
            <p>Would you like to accept this driver?</p>
            <div className="popup-buttons">
              <button 
                onClick={() => handleDriverResponse(true)} 
                className="btn btn-success"
              >
                Accept
              </button>
              <button 
                onClick={() => handleDriverResponse(false)} 
                className="btn btn-danger"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
