'use strict';
import Database from "/js/Database.mjs";
import {PromiseMap, getYYYYMMDDFormat, sameDay} from "/js/utils.mjs";


/**
* Store all selected month's dues in a buffer
**/ 
class DueBuffer {

	#database = undefined;
	#buffer = new PromiseMap();
	#loadedDate = undefined;


	constructor(database) {
		this.#database = database;
	}


	async loadDuesFromDatabase(date) {
		if (!(date instanceof Date))
			throw new Error("Given date is not a Date object");

		this.#buffer.clear();

		this.#loadedDate = new Date(date.getFullYear(), date.getMonth());

		let dues = [];
		let curDate = undefined;

		this.#database.loadAllDuesFromMonth(date, (due) => {

			if (!sameDay(curDate, due.date)) {

				if (curDate !== undefined) {
					this.#buffer.resolve(getYYYYMMDDFormat(curDate), dues);
				}

				curDate = new Date(due.date);
				dues = [ due ];
			}
			else {
				dues.push(due);
			}

		})
		.then(() => {
			if (curDate !== undefined) {
				this.#buffer.resolve(getYYYYMMDDFormat(curDate), dues);
			}
			// Resolve dates that had no dues 
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


	// retrieve all daliies given by date
	getDuesFromDate(date) {
		return new Promise((resolve, reject) => {
			if (!(date instanceof Date))
				throw new Error("Given date is not a Date object");

			// Refresh buffer if requested for different month from what is stored
			if (date.getMonth() !== this.#loadedDate?.getMonth() || date.getFullYear() !== this.#loadedDate?.getFullYear()) {
				this.loadDuesFromDatabase(date);
			}

			this.#buffer.get(getYYYYMMDDFormat(date))
			.then((dues) => {
				resolve(dues);
			})
			.catch((error) => {
				throw error;
			});
		});	
	}

	getDuesFromTitle(title) {
		return new Promise((resolve, reject) => {
			if (typeof title !== "string") 
				throw new Error("Given title is not a string");

			// // Refresh buffer if requested for different month from what is stored
			// if (date.getMonth() !== this.#loadedDate?.getMonth() || date.getFullYear() !== this.#loadedDate?.getFullYear()) {
			// 	this.loadDuesFromDatabase(date);
			// }

			// FIXME: need a way to find a due given title
		});	
	}


	removeDues(due) {
		return new Promise((resolve, reject) => {
			this.#database.deleteDaily(due.did).then(() => {
				return this.#buffer.get(getYYYYMMDDFormat(due.date));
			})
			.then( (dues) => {
				const dueIndex = dues.findIndex(due);
				if (dueIndex >= 0) 
					dues.splice(dueIndex, 1);

				resolve(true);
			})
			// FIXME: no error handling for now
			.catch((reason) => {
				throw reason;
			});
		});
	}


	addDue(due) {
		return new Promise((resolve, reject) => {
			this.#database.addDue(due).then(() => {
				if (!this.#buffer.has(getYYYYMMDDFormat(due.date)))
					this.#buffer.resolve(getYYYYMMDDFormat(due.date), [due]);
				return this.#buffer.get(getYYYYMMDDFormat(due.date));
			})
			.then((dues) => {
				dues.push(due);

				resolve(true);
			})
			// FIXME: no error hanlding
			.catch((reason) => {
				throw reason;
			});
		});
	}
}



export default DueBuffer;