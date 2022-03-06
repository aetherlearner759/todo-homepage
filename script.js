// Get DOM objects
clockTimeEl = document.getElementById("clock-time");
clockDateEl = document.getElementById("clock-date");
dailyListEl = document.getElementById("daily-list");

// Global variables


init();

async function init() {

	updateClock()
	setInterval(updateClock, 1000)

	if ( !(await openDB()) ) {
		console.log("Database failed to open");
		const errorTodoEl = document.createElement('li');
		errorTodoEl.innerHTML = `
			<span class="todo-name">Failed to Access Dailies</span>
		`;
		dailyListEl.prepend(errorTodoEl);

		return false;
	}

	// Now do stuff with opened database

}


/*
Opens main_db database and returns a promise containing a boolean value of 
whether it succeeded or not. 
If main_db does not exist then it sets up the main_db database
*/
function openDB() {

	return new Promise((resolve, reject) => {
		let req = indexedDB.open('main_db');

		req.onsuccess = () => {
			db = req.result;
			return resolve(true);
		};

		req.onerror = () => {
			return reject(false);
		};

		req.onupgradeneeded = (e) => {
			db = e.target.result; 

			// Create object store to store daily tasks
			let todoObjStore = db.createObjectStore('daily_os', { keyPath: 'did', autoIncrement:true });

			// Specify schema of the daily object store
			todoObjStore.createIndex('title', 'title', { unique:false });
			todoObjStore.createIndex('subtitle', 'subtitle', { unique:false });
			todoObjStore.createIndex('date', 'date', { unique: false });
		  	todoObjStore.createIndex('prior', 'prior', { unique: false });
			todoObjStore.createIndex('comp', 'comp', { unique: false });

			// FIXME: We did not add other object stores like
			// projects, duedates, subtasks, and maybe others

		 	console.log("Database setup complete");
		};
	});
}


/*
Given JS date object, return a promise of an array of dailies on that date.
*/
function loadDailyDB(date) {

	return new Promise((resolve) => {

		array = [];
		date = getYYYYMMDD(date); 

		// Set up transaction
		const trans = db.transaction(['daily_os'], 'readonly');
		
		// Set up cursor
		const dateIndex = trans.objectStore('daily_os').index('date');
		const keyRange = IDBKeyRange.only(date);
		const cursorReq = dateIndex.openCursor(keyRange);

		cursorReq.onsuccess = (e) => {
			const cursor = e.target.result;
			if (cursor) {
				const daily = cursor.value;

				array.push(daily);

				cursor.continue();
			}	
			else {
				sortDailies(array);
				return resolve(array);
			}
		};
	});
}


/*
Given a JSON-formatted item, add the item to the daily objectstore
*/
function addDailyDB(item) {

	return new Promise((resolve, reject) => {

		const trans = db.transaction(['daily_os'], 'readwrite');
		const req = trans.objectStore('daily_os').add(item);

		req.onsuccess = function(e) {
			item.did = e.target.result;
			dailyArray.push(item);
			return resolve(true);
		};
		trans.oncomplete = function(e) {
			return resolve(true);
		}
		trans.onerror = function () {
			return reject(false);
		}
	});
}


/*
Delete a daily from daily objectstore given its id
*/
function deleteDailyDB(id) {

	return new Promise((resolve, reject) => {
		const trans = db.transaction(['daily_os'], 'readwrite');
		const req = trans.objectStore('daily_os').delete(id);

		req.onsuccess = (e) => {
			return resolve(true);
		}
		req.oncomplete = (e) => {
			return resolve(true);
		}
		req.onerror = (e) => {
			return reject(false);
		}
	});
}


/*
Toggle the complete attribute of a daily from daily objectore given its id
*/
function toggleCompTodoDB(id) {

	return new Promise((resolve, reject) => {
		const trans = db.transaction(['daily_os'], 'readwrite');
		const objStore = trans.objectStore('daily_os');
		const req = objStore.get(id);

		req.onsuccess = (e) => {
			var daily = e.target.result;
			daily.comp = !daily.comp;

			var reqUpdate = objStore.put(daily);
			reqUpdate.onerror = (e) => {
				return resolve(false);
			}
			reqUpdate.onsuccess = (e) => {
				return resolve(true);
			}
		}
	});
}

// FIXME: Delete this function on deployment
function deleteDB() {
	var request = indexedDB.deleteDatabase('main_db');

	request.onsuccess = function() {
		console.log("Database deleted");
	}

	request.onerror = function() {
		console.log("Database failed to be deleted");
	}
}


/*
Updates the clock container with the right time and date
*/
function updateClock() {
	curDate = new Date()

	let hour = curDate.getHours();
	let min = curDate.getMinutes();
	clockTimeEl.innerText = `${(hour%12 == 0) ? 12 : hour%12} : ${(min < 10) ? "0"+min : min} ${(hour < 12) ? "AM" : "PM"}`

	clockDateEl.innerText = getYYYYMMDD(curDate);
}


/*
Helper function.
Just return a string in format "YYYY-MM-DD" from JS date object. 
*/
function getYYYYMMDD(date) {
	let year = date.getFullYear();
	let month = date.getMonth()+1;
	let days = date.getDate();
	let str = `${year}-${(month < 10) ? "0"+month : month}-${(days < 10) ? "0"+days : days}`;

	return str;
}