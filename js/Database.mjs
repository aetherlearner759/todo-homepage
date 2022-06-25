'use strict';
// kinda useless since code inside classes are already in strict mode. Whatever~


// Given a date object, return a string of format `YYYY-MM-DD`
const getYYYYMMDDFormat = function(date) {
	let year = date.getFullYear();
	let month = date.getMonth()+1;
	let days = date.getDate();

	return `${year}-${(month < 10) ? "0"+month : month}-${(days < 10) ? "0"+days : days}`;
}


/**
* An object containing methods for the Database object
* Exports:
* 	open - opens database with given name
*	addDaily - adds daily to daily object store
*	addDue - adds duedate to duedate object store
*	loadDaily - load daily given date
*	loadDue - load dues given date
*	deleteDaily - deletes daily from daily object store
*	toggleComp - toggles complet status of daily object
*	deleteDB - deletes database
*
**/
export const Database = (function() {

	// // FIXME: better for user to init the database rather than the module doing it itself.
	// // Initialize database
	// const db = await open("main_db");
	// // FIXME: Properly handle error 
	// if (!db) {
	// 	location.reload();
	// }



	// FIXME: Delete this function on deployment
	function insertDB() {
		let now = new Date(2022, 10, 31);
		icons = ["square", "circle", "diamond", "feather", "certificate", "calendar-check", "exclamation", "user-graduate", "user-code", "user-bag-shopping", "user-book"];

		for (let d = new Date(2022, 4, 1); d < now; d.setDate(d.getDate()+1)) {
			let numDailies = Math.floor(Math.random()*10);
			for(; numDailies > 0; numDailies--) {
				let item = {
					title: `Task ${numDailies}`,
					subtitle: `Subtitle ${numDailies}`,
					date: getYYYYMMDD(d),
					prior: Math.ceil(Math.random()*5),
					comp: Math.floor(Math.random()*2),
				}
				addDaily(item);
			}

			let roll = Math.floor(Math.random()*10);
			if (roll == 9) {
				let numDues = Math.floor(Math.random()*5);
				for(; numDues > 0; numDues--) {
					let due = {
						title: `Due ${numDues}`,
						duedate: getYYYYMMDD(d),
						duetime: "05:00",
						icon: icons[Math.floor(Math.random()*icons.length)]
					}
					addDue(due);
				}
			}
		}

		return;
	}


	/**
	* Opens a database given by its specified name 
	* If database is not created or up-to-date, then the schema will be updated. 
	* Args:
	*	Name of the database to open
	* Return:
	* 	Promise with value of the opened database. Throws error if failure to open database
	**/
	const open = function openDatabase(database_name) {

		return new Promise((resolve, reject) => {

			let req = indexedDB.open(database_name);

			req.onsuccess = () => {
				return resolve(req.result);
			};

			req.onerror = () => {
				return reject(new Error("Database could not be opened"));
			};

			req.onupgradeneeded = (e) => {
				const database = e.target.result; 

				// Create object store to store daily tasks
				let todoObjStore = database.createObjectStore('daily_os', { keyPath: 'did', autoIncrement:true });

				// Specify schema of the daily object store
				todoObjStore.createIndex('title', 'title', { unique:false });
				todoObjStore.createIndex('subtitle', 'subtitle', { unique:false });
				todoObjStore.createIndex('date', 'date', { unique: false });
			  	todoObjStore.createIndex('prior', 'prior', { unique: false });
				todoObjStore.createIndex('comp', 'comp', { unique: false });

				// Create object store to store due dates
				let dueObjStore = database.createObjectStore('due_os', { keyPath: 'ddid', autoIncrement: true });

				// Specify schema of the due date object store
				dueObjStore.createIndex('title', 'title', { unique:false });
				dueObjStore.createIndex('duedate', 'duedate', { unique:false });
				dueObjStore.createIndex('duetime', 'duetime', { unique: false });
				dueObjStore.createIndex('icon', 'icon', { unique: false });

				// FIXME: We did not add other object stores like
				// projects, subtasks, and maybe others

			 	console.log("Database setup complete");
			};
		});
	}


	/**
	* Adds object to object store in database
	* Args
	* 	objectStoreName - String of the name of the object store
	* 	object - Object to add
	* Return
	* 	Promise that resolves to true if success. Otherwise throws error
	**/
	const addObjToStore = function addObjectToObjectStore(objectStoreName, object) {

		return new Promise((resolve, reject) => {

			const trans = db.transaction([objectStoreName], 'writeonly');
			const req = trans.objectStore(objectStoreName).add(object);

			req.onsuccess = function(e) {
				item.did = e.target.result;
				return resolve(true);
			};
			trans.oncomplete = function(e) {
				return resolve(true);
			}
			trans.onerror = function(e) {
				return reject(new Error(`Could not add item to ${objectStoreName}`));
			}
		});
	}

	/**
	* Add new todo object to the database
	* Args
	* 	item - a todo object
	* Return
	* 	Promise resolved to true if success. Otherwise throws error
	**/
	const addDaily = addObjToStore.bind(null, "daily_os");

	/**
	* Add new duedate object to the database
	* Args
	* 	item - a duedate object
	* Return
	* 	Promise resolved to true if success. Otherwise throws error
	**/
	const addDue = addObjToStore.bind(null, "due_os");


	/**
	* Load all objects in a object store within a given date keyrange
	* Args
	* 	objectStoreName - name of the object store to search through
	* 	keyRange - IDBKeyRange object storing the date key range to search through
	* Return
	* 	Promise resolved to array of objects found. If error, throws error.
	**/
	const loadObjFromDates = function loadObjectsFromObjectStoreWithinDateRange(objectStoreName, keyRange) {

		return new Promise((resolve, reject) => {

			const objectArray = [];

			const transaction = db.transaction([objectStoreName], 'readonly');

			const dateIndex = transaction.objectStore(objectStoreName).index('date');
			const cursorRequest = dateIndex.openCursor(keyRange);

			cursorRequest.onsuccess = (e) => {
				const cursor = e.target.result;

				if (cursor) {
					const obj = cursor.value;
					objectArray.push(obj);
					cursor.continue();
				}
				else {
					return resolve(objectArray);
				}
			}

			cursorRequest.onerror = (e) => {
				return reject(new Error(`Could not open cursor in ${objectStoreName}`));
			}
		});
	}

	/**
	* Load all daily objects into an array from a given date
	* Args
	* 	date -> YYYY-MM-DD format date string or date object
	* Return
	* 	Promise that resolves to array of todo objects. If error, throw Error
	**/
	const loadDaily = async function loadAllDailyFromDay(date) {

		const keyRange = IDBKeyRange.only(date);

		return loadObjFromDates("daily_os", keyRange);
	}

	/**
	* Load all due dates from a month into an array from a given date
	* Args
	* 	date -> date object or month string
	* Return
	* 	Promise that resolves to array of todo objects. If error, throw Error
	**/
	const loadDues = async function loadAllDuesFromMonth(date) {

		// Get first day of month and last day of month
		let firstDay, lastDay;
		if (date instanceof Date) {
			firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
			firstDate = getYYYYMMDDFormat(firstDate); 

			lastDay = new Date(date.getFullYear(), date.getMonth()+1, 0);
			secondDate = getYYYYMMDDFormat(secondDate);
		}
		// FIXME: handle non date objects
		const keyRange = IDBKeyRange.bound(firstDay, lastDay);

		return loadObjFromDates("due_os", keyRange);
	}


	/**
	* Deletes an object from an object store given its id
	* Arg
	* 	objectStoreName - string name of the object store to delete from
	*   id - id of the object to delete
	* Return
	*   Promise resolved to true if success. If error, throw error
	* 
	**/ 
	const deleteObjFromStore = function deleteObjectFromObjectStore(objectStoreName, id) {

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([objectStoreName], 'readwrite');
			const request = transaction.objectStore(objectStoreName).delete(id);

			request.onsuccess = (e) => {
				return resolve(e);
			}

			request.oncomplete = (e) => {
				return resolve(e);
			}

			request.onerror = (e) => {
				return reject(new Error(`Could not delete item with id ${id} from ${objectStoreName} object store`));
			}
		});
	}
	
	/**
	* Delete a todo object from daily objectstore given its id
	* Args
	* 	id - id of the todo object
	* Return
	* 	Promise resolved to true if success. Otherwise false
	**/
	const deleteDaily = deleteObjFromStore.bind(null, "daily_os");

	/**
	* Delete a duedate object from duedate objectstore given its id
	* Args
	* 	id - id of the duedate object
	* Return
	* 	Promise resolved to true if success. Otherwise false
	*/
	const deleteDue = deleteObjFromStore.bind(null, "due_os");
	

	/**
	* Toggle the complete attribute of a daily from daily objectore given its id
	* Args
	* 	id - id of the daily object
	* Return
	* 	Promise resolved to true if success. Otherwise false
	**/
	const toggleComp = function toggleCompletedStatusFromDaily(id) {

		return new Promise((resolve, reject) => {

			const trans = db.transaction(['daily_os'], 'readwrite');
			const objStore = trans.objectStore('daily_os');
			const req = objStore.get(id);

			req.onsuccess = (e) => {
				const daily = e.target.result;
				daily.comp = !daily.comp;

				const reqUpdate = objStore.put(daily);
				reqUpdate.onsuccess = (e) => {
					return resolve(true);
				}
				reqUpdate.onerror = (e) => {
					return reject(new Error(`Could not toggle the completed status of daily object with id ${id}`));
				}
			}

			req.onerror = (e) => {
				return reject(new Error(`Could not get daily object from its id ${id}`));
			}
		});
	}


	// FIXME: Might remove this. Keep it for debugging purposes for now
	function deleteDB() {
		var request = indexedDB.deleteDatabase('main_db');

		request.onsuccess = function() {
			console.log("Database deleted");
		}

		request.onerror = function() {
			console.log("Database failed to be deleted");
		}
	}
	

	return 
	{
		insertDB, 
		open,
		addDaily,
		addDue,
		loadDaily,
		loadDue,
		deleteDaily,
		toggleComp,
		deleteDB
	}
})();


