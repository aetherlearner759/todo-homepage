'use strict';
import Database from "/js/Database.mjs";
import {PromiseMap, getYYYYMMDDFormat, sameDay} from "/js/utils.mjs";


/**
* Store all selected month's dailies in a buffer
* Methods:
* 	loadDailiesFromDatabase - load all dailies from database within a month given a date object
* 	getDailiesFromDate - get all dailies given a date object
* 	removeDaily - remove daily object from database given its daily object
* 	addDaily - add daily object to database given its daily object
* 	toggleDailyComp - toggle the complete property of given daily object
**/ 
class DailyBuffer {

	#database = undefined;
	#buffer = new PromiseMap();
	#loadedDate = undefined;


	constructor(database) {
		this.#database = database;
	}

	// Loads all dailies in a month given a date object
	async loadDailiesFromDatabase(date) {
		if (!(date instanceof Date))
			throw new Error("Given date is not a Date object");

		this.#buffer.clear();

		this.#loadedDate = new Date(date.getFullYear(), date.getMonth());

		let dailies = [];
		let curDate = undefined;

		this.#database.loadAllDailyFromMonth(date, (daily) => {

			if (!sameDay(curDate, daily.date)) {

				if (curDate !== undefined) {
					this.#buffer.resolve(getYYYYMMDDFormat(curDate), dailies);
				}

				curDate = new Date(daily.date);
				dailies = [ daily ];
			}
			else {
				dailies.push(daily);
			}

		})
		.then(() => {
			if (curDate !== undefined) {
				this.#buffer.resolve(getYYYYMMDDFormat(curDate), dailies);
			}
			// Resolve dates that had no dailies 
			let firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
			let lastDay = new Date(date.getFullYear(), date.getMonth()+1, 0);

			// FIXME: don't like how i do this here. 
			while (firstDay <= lastDay) {
				this.#buffer.resolve(getYYYYMMDDFormat(firstDay), []);
				firstDay.setDate(firstDay.getDate()+1);
			}
			return;
		})
		// FIXME: More proper error handling
		.catch((reason) => {
			throw reason;
		}); 		
	}	


	// Retrieve all daliies given by date
	getDailiesFromDate(date) {
		return new Promise((resolve, reject) => {
			if (!(date instanceof Date))
				throw new Error("Given date is not a Date object");

			// Refresh buffer if requested for different month from what is stored
			if (date.getMonth() !== this.#loadedDate?.getMonth() || date.getFullYear() !== this.#loadedDate?.getFullYear()) {
				this.loadDailiesFromDatabase(date);
			}

			this.#buffer.get(getYYYYMMDDFormat(date))
			.then((dailies) => {
				resolve(dailies);
			})
			.catch((error) => {
				throw error;
			});
		});	
	}


	removeDaily(daily) {
		return new Promise((resolve, reject) => {
			this.#database.deleteDaily(daily.did).then(() => {
				return this.#buffer.get(getYYYYMMDDFormat(daily.date));
			})
			.then( (dailies) => {
				const dailyIndex = dailies.findIndex((d) => d.did === daily.did);
				if (dailyIndex >= 0) 
					dailies.splice(dailyIndex, 1);
				resolve(true);
			})
			// FIXME: no error handling for now
			.catch((reason) => {
				throw reason;
			});
		});
	}

	// FIXME: have to manually set id of newly added item
	addDaily(daily) {
		return new Promise((resolve, reject) => {
			this.#database.addDaily(daily).then((id) => {
				if (!this.#buffer.has(getYYYYMMDDFormat(daily.date)))
					this.#buffer.resolve(getYYYYMMDDFormat(daily.date), [daily]);
				daily.did = id;
				return this.#buffer.get(getYYYYMMDDFormat(daily.date));
			})
			.then((dailies) => {
				dailies.push(daily);

				resolve(true);
			})
			// FIXME: no error hanlding
			.catch((reason) => {
				throw reason;
			});
		});
	}

	toggleDailyComp(daily) {
		return new Promise((resolve, reject) => {
			this.#database.toggleCompletedStatusFromDaily(daily.did)
			.then(() => {
				return this.#buffer.get(getYYYYMMDDFormat(daily.date));
			})
			.then((dailies) => {
				daily = dailies.find((d) => d.did === daily.did);
				daily.comp = !daily.comp;
				resolve(true);
			});
		});
	}
}



export default DailyBuffer;