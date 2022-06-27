import Database from "/js/Database.mjs";


// FIXME: Consider placing this function inside a helper javascript file 
// Given a date object, return a string of format `YYYY-MM-DD`
const getYYYYMMDDFormat = function(date) {
	let year = date.getFullYear();
	let month = date.getMonth()+1;
	let days = date.getDate();

	return `${year}-${(month < 10) ? "0"+month : month}-${(days < 10) ? "0"+days : days}`;
}


/**
* A subclass of Map class. The values are promises that will be resolved when set
* 
* 
* 
* 
**/
class PromiseMap extends Map{

	constructor() {
		super();
		// Store resolver functions that still need to resolve promises
		this.resolvers = new Map();
	}

	get(key) {
		// If value already exists, delegate to Map's get()
		if (this.has(key)) {
			return super.get(key);
		}

		// Otherwise, promise to the user the value
		let promise = new Promise((resolve) => {
			// Add to the list of things we will have to resolve
			this.resolvers.set(key, resolve);
		});
		// Set it to avoid duplicates
		this.set(key, promise);
		// Delegate to Map
		return super.get(key);
	}

	set(key, value) {
		// If it was promised by a user or by get()
		if (this.has(key)) {
			// Resolve the promise
			const resolvePromise = this.resolvers.get(key);
			resolvePromise(value);
			this.resolvers.delete(key);

			return super.get(key);
		}
		// If it wasn't a promised value pair, statically resolve the promise
		return super.set(key, Promise.resolve(value));
	}

	resolveAll() {
		this.resolvers.forEach( (value, key) => {
			const resolvePromise = value;
			resolvePromise(undefined);
			this.resolvers.delete(key);
		});
	}
}


/**
* Store all selected month's dailies in a buffer
* 
* 
**/ 
class DailyBuffer {

	#database = undefined;
	#buffer = new PromiseMap();
	#date = undefined;


	constructor(database) {
		this.#database = database;
	}

	async loadDailiesFromDatabase(date) {
		// Clear buffer
		this.#buffer.clear();
		// Reset date
		this.#date = new Date(date.getFullYear(), date.getMonth());

		let dailies = [];
		let curDate = undefined;
		// Grab data from database
		this.#database.loadDailies(date, (daily) => {

			if (curDate !== daily.date) {

				if (curDate !== undefined) {
					this.#buffer.set(curDate, dailies);
				}

				curDate = daily.date;
				dailies = [];
			}
			else {
				dailies.push(daily);
			}

		})
		.then(() => {
			if (curDate !== undefined) {
				this.#buffer.set(curDate, dailies);
			}
			this.#buffer.resolveAll();
			return;
		})
		// FIXME: More proper error handling
		.catch((reason) => {
			throw reason;
		}); 		
	}	


	// retrieve all daliies given by date
	getDailiesFromDate(date) {

		return new Promise((resolve, reject) => {
			// Refresh buffer if requested for different month from what is stored
			if (date.getMonth() !== this.#date?.getMonth() || date.getFullYear() !== this.#date?.getFullYear()) {
				this.loadDailiesFromDatabase(date);
			}

			this.#buffer.get(getYYYYMMDDFormat(date))
			.then((dailies) => {
				if (!dailies)
					return resolve([]);
				return resolve(dailies);
			})
			.catch((error) => {
				return reject(error);
			});
		});	
	}
}



export default DailyBuffer;