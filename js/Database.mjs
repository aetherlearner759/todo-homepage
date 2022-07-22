'use strict';
import {getMonthRange} from "/js/utils.mjs";


/**
* Singleton database object
* Methods:
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
class Database {
	
	static DAILY_OBJ_STORE = "daily_os";
	static DUE_OBJ_STORE = "due_os";
	#db = undefined;

	constructor() {
		if (Database._instance) {
	      throw new Error("Database is a singleton class; it can't be instantiated more than once.");
	    }
	    Database._instance = this;
	}

	/**
	* Checks if given object is a valid object to store in given object store
	* Args
	* 	object - object to validate
	* 	objectStoreName - name of the object store
	* Return
	* 	Boolean value 
	**/
	#isObjectForObjectStore(object, objectStoreName) {
		if (!this.#db)
			throw new Error("Database not opened");
		if (typeof objectStoreName !== "string")
			throw new Error("Given object store name is not a string");
		if (typeof object !== "object")
			return false;

		const objectStore = this.#db.transaction([objectStoreName], 'readonly').objectStore(objectStoreName);
		const indexNames = objectStore.indexNames;

		if (!Array.prototype.every.call(indexNames, (name) => name in object))
			return false;

		return true;
	}

	isDailyObject(object) {
		return this.#isObjectForObjectStore(object, Database.DAILY_OBJ_STORE);
	}

	isDueObject(object) {
		return this.#isObjectForObjectStore(object, Database.DUE_OBJ_STORE);
	}

	/**
	* Opens a database given by its specified name 
	* If database is not created or up-to-date, then the schema will be updated. 
	* Args:
	*	Name of the database to open
	* Return:
	* 	Promise with value of the opened database. Throws error if failure to open database
	**/
	open(database_name) {
		return new Promise((resolve, reject) => {

			if (typeof database_name !== "string") 
				throw new Error("Given database name is not a string");
			

			let req = indexedDB.open(database_name);

			req.onsuccess = () => {
				if (this.#db) 
					throw new Error("A database is already opened");
				this.#db = req.result;
				return resolve(this);
			};

			req.onerror = () => {
				throw new Error("Database could not be opened");
			};

			req.onupgradeneeded = (e) => {
				const database = e.target.result; 

				// Set up object store to store daily tasks
				let todoObjStore = database.createObjectStore(Database.DAILY_OBJ_STORE, { keyPath: 'did', autoIncrement:true });
				todoObjStore.createIndex('title', 'title', { unique:false });
				todoObjStore.createIndex('subtitle', 'subtitle', { unique:false });
				todoObjStore.createIndex('date', 'date', { unique: false });
			  	todoObjStore.createIndex('prior', 'prior', { unique: false });
				todoObjStore.createIndex('comp', 'comp', { unique: false });

				// Create object store to store due dates
				let dueObjStore = database.createObjectStore(Database.DUE_OBJ_STORE, { keyPath: 'ddid', autoIncrement: true });
				dueObjStore.createIndex('title', 'title', { unique:false });
				dueObjStore.createIndex('date', 'date', { unique:false });
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
	* 	Promise that resolves to added object id if success. Otherwise throws error
	**/
	#addObjectToObjectStore(objectStoreName, object) {

		return new Promise((resolve, reject) => {

			if (!this.#db)
				throw new Error("Cannot add object to objectstore; there is no database opened.");
			if (typeof objectStoreName !== "string")
				throw new Error("Given object store name is not a string");
			if (typeof object !== "object")
				throw new Error("Given object is not an object");

			const transaction = this.#db.transaction([objectStoreName], 'readwrite');
			const objectStore = transaction.objectStore(objectStoreName);

			const request = objectStore.add(object);

			request.onsuccess = function(e) {
				return resolve(e.target.result);
			};
			transaction.oncomplete = function(e) {
				return resolve(e.target.result);
			}
			transaction.onerror = function(e) {
				throw new Error(`Could not add item to ${objectStoreName}`);
			}
		});
	}

	/**
	* Add new todo object to the database
	* Args
	* 	todo - a todo object
	* Return
	* 	Promise resolved to true if success. Otherwise throws error
	**/
	addDaily(todo) {
		if (!this.isDailyObject(todo))
			throw new Error("Given object is not a valid daily object");

		return this.#addObjectToObjectStore(Database.DAILY_OBJ_STORE, todo);
	}

	/**
	* Add new duedate object to the database
	* Args
	* 	item - a duedate object
	* Return
	* 	Promise resolved to true if success. Otherwise throws error
	**/
	addDue(due) {
		if (!this.isDueObject(due))
			throw new Error("Given object is not a valid due object");

		return this.#addObjectToObjectStore(Database.DUE_OBJ_STORE, due);
	}


	/**
	* Load all objects in a object store within a given date keyrange
	* Args
	* 	objectStoreName - name of the object store to search through
	* 	keyRange - IDBKeyRange object storing the date key range to search through
	* 	callback - function to call on each cursor object as the cursor iterates over the items
	* Return
	* 	Promise resolved to array of objects found. If error, throws error.
	**/
	#loadObjectsFromObjectStoreWithinDateRange(objectStoreName, keyRange, callback) {

		return new Promise((resolve, reject) => {

			if (!this.#db)
				throw new Error("Cannot add object to objectstore; there is no database opened.");
			if (typeof objectStoreName !== "string")
				throw new Error("Given object store name is not a string");
			if (!(keyRange instanceof IDBKeyRange))
				throw new Error("Given key range is not an IDBKeyrange");
			if (typeof callback !== "function")
				throw new Error("Given callback function is not a function");

			const objectArray = [];

			const transaction = this.#db.transaction([objectStoreName], 'readonly');

			const dateIndex = transaction.objectStore(objectStoreName).index('date');
			const cursorRequest = dateIndex.openCursor(keyRange);

			cursorRequest.onsuccess = (e) => {
				const cursor = e.target.result;

				if (cursor) {
					const obj = cursor.value;

					if(!callback) {
						objectArray.push(obj);
					}
					else {
						callback(obj);
					}
					
					cursor.continue();
				}
				else {
					if (!callback)
						return resolve(objectArray);
					else 
						return resolve(true);
				}
			}

			cursorRequest.onerror = (e) => {
				throw new Error(`Could not open cursor in ${objectStoreName}`);
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
	async loadAllDailyFromMonth(date, callback) {

		if (!(date instanceof Date))
			throw new Error("Given date is not a Date object");

		let [ firstDay, lastDay ] = getMonthRange(date);
		// FIXME: handle non date objects
		const keyRange = IDBKeyRange.bound(firstDay, lastDay);

		return this.#loadObjectsFromObjectStoreWithinDateRange(Database.DAILY_OBJ_STORE, keyRange, callback);
	}

	/**
	* Load all due dates from a month into an array from a given date
	* Args
	* 	date -> date object or month string
	* Return
	* 	Promise that resolves to array of todo objects. If error, throw Error
	**/
	async loadAllDuesFromMonth(date, callback) {

		if (!(date instanceof Date))
			throw new Error("Given date is not a Date object");

		// Get first day of month and last day of month
		let [ firstDay, lastDay ] = getMonthRange(date);
		// FIXME: handle non date objects
		const keyRange = IDBKeyRange.bound(firstDay, lastDay);

		return this.#loadObjectsFromObjectStoreWithinDateRange(Database.DUE_OBJ_STORE, keyRange, callback);
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
	#deleteObjectFromObjectStore(objectStoreName, id) {

		return new Promise((resolve, reject) => {

			if (!this.#db)
				throw new Error("Cannot add object to objectstore; there is no database opened.");
			if (typeof objectStoreName !== "string")
				throw new Error("Given object store name is not a string");
			if (typeof id !== "number") {
				id = parseInt(id);
				if (isNaN(id))
					throw new Error("Given id must be a number");
			}

			const transaction = this.#db.transaction([objectStoreName], 'readwrite');
			const request = transaction.objectStore(objectStoreName).delete(id);

			request.onsuccess = (e) => {
				return resolve(e.target.result);
			}

			request.oncomplete = (e) => {
				return resolve(e.target.result);
			}

			request.onerror = (e) => {
				throw new Error(`Could not delete item with id ${id} from ${objectStoreName} object store`);
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
	deleteDaily(id) {
		return this.#deleteObjectFromObjectStore(Database.DAILY_OBJ_STORE, id);
	}

	/**
	* Delete a duedate object from duedate objectstore given its id
	* Args
	* 	id - id of the duedate object
	* Return
	* 	Promise resolved to true if success. Otherwise false
	*/
	deleteDue(id) {
		return this.#deleteObjectFromObjectStore(Database.DUE_OBJ_STORE, id);
	}
	

	/**
	* Toggle the complete attribute of a daily from daily objectore given its id
	* Args
	* 	id - id of the daily object
	* Return
	* 	Promise resolved to true if success. Otherwise false
	**/
	toggleCompletedStatusFromDaily(id) {

		return new Promise((resolve, reject) => {
			if (typeof id !== "number") {
				id = parseInt(id);
				if (isNaN(id))
					throw new Error("Given id must be a number");
			}


			const trans = this.#db.transaction([Database.DAILY_OBJ_STORE], 'readwrite');
			const objStore = trans.objectStore(Database.DAILY_OBJ_STORE);
			// FIXME: having trouble finding id even though it exists?
			const req = objStore.get(id);

			req.onsuccess = (e) => {
				const daily = e.target.result;

				if (!daily) {				
					reject(`Daily with id, ${id}, not found`);
					return;
				}

				daily.comp = !daily.comp;

				const reqUpdate = objStore.put(daily);
				reqUpdate.onsuccess = (e) => {
					resolve(e.target.result);
				}
				reqUpdate.onerror = (e) => {
					throw new Error(`Could not toggle the completed status of daily object with id ${id}`);
				}
			}

			req.onerror = (e) => {
				throw new Error(`Could not get daily object from its id ${id}`);
			}
		});
	}


	// FIXME: Might remove this. Keep it for debugging purposes for now
	deleteDB() {
		var request = indexedDB.deleteDatabase('test_db');

		request.onsuccess = function() {
			console.log("Database deleted");
		}

		request.onerror = function() {
			console.log("Database failed to be deleted");
		}
	}



	// FIXME: Delete this function on deployment
	insertDB() {
		let now = new Date(2022, 10, 31);
		const icons = ["square", "circle", "diamond", "feather", "certificate", "calendar-check", "exclamation", "user-graduate", "user-code", "user-bag-shopping", "user-book"];

		for (let d = new Date(2022, 4, 1); d < now; d.setDate(d.getDate()+1)) {
			let numDailies = Math.floor(Math.random()*10);
			for(; numDailies > 0; numDailies--) {
				const newd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(Math.random()*24), Math.floor(Math.random()*60), Math.floor(Math.random()*999), )
				let item = {
					title: `Task ${numDailies}`,
					subtitle: `Subtitle ${numDailies}`,
					date: newd,
					prior: Math.ceil(Math.random()*5),
					comp: Math.floor(Math.random()*2),
				}
				this.addDaily(item);
			}

			let roll = Math.floor(Math.random()*10);
			if (roll == 9) {
				let numDues = Math.floor(Math.random()*5);
				for(; numDues > 0; numDues--) {
					let due = {
						title: `Due ${numDues}`,
						date: d,
						icon: icons[Math.floor(Math.random()*icons.length)]
					}
					this.addDue(due);
				}
			}
		}

		return;
	}


	// FIXME: delete this later
	async loadAllDailies() {
		// FIXME: instead of parsing the date as string, we can just use dates
		let firstDay = new Date(2022, 5, 3);
		let lastDay = new Date(2022, 7, 13);
		lastDay.setMilliseconds(-1);
		console.log(firstDay, lastDay);
		const keyRange = IDBKeyRange.bound(firstDay, lastDay);

		const transaction = this.#db.transaction(["daily_os"], 'readonly');

		const dateIndex = transaction.objectStore("daily_os").index('date');
		const cursorRequest = dateIndex.openCursor(keyRange);

		let oldDate = firstDay;

		cursorRequest.onsuccess = (e) => {
			const cursor = e.target.result;

			if (cursor) {
				const obj = cursor.value;

				if (oldDate < obj.date) {
					oldDate = obj.date;
				}
				else {
					console.log("ERRPR", oldDate, obj.date);
				}
				//console.log(obj.date);
				
				cursor.continue();
			}
		}

		cursorRequest.onerror = (e) => {
			return reject(new Error(`Could not open cursor in ${objectStoreName}`));
		}
	}

};



export default Database;