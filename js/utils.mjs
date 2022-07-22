'use strict';

const getYYYYMMDDFormat = function(date) {
	if (!(date instanceof Date))
		throw new Error("Given date is not a Date object");
	let year = date.getFullYear();
	let month = date.getMonth()+1;
	let days = date.getDate();

	return `${year}-${(month < 10) ? "0"+month : month}-${(days < 10) ? "0"+days : days}`;
}

const getMonthRange = function getMonthRangeFromDate(date) {
	if (!(date instanceof Date))
		throw new Error("Given date is not a Date object");

	const firstDate = new Date(date.getFullYear(), date.getMonth(), 1);
	const lastDate = new Date(date.getFullYear(), date.getMonth()+1, 1, 0, 0, -1);

	return [firstDate, lastDate];
}

const sameMonth = function isSameMonthSameYear(date1, date2) {
	if (date1 === undefined || date2 === undefined)
		return false;
	if (!(date1 instanceof Date) || !(date2 instanceof Date))
		throw new Error("Given dates are not Date objects");

	return date1.getFullYear() === date2.getFullYear()
		&& date1.getMonth() === date2.getMonth();
}

const sameDay = function isSameDaySameMonthAndYear(date1, date2) {
	if (date1 === undefined || date2 === undefined)
		return false;
	if (!(date1 instanceof Date) || !(date2 instanceof Date))
		throw new Error("Given dates are not Date objects");

	return date1.getDate() === date2.getDate() 
		&& sameMonth(date1, date2);
}


/**
* A subclass of Map class. The values are promises that will be resolved when set
* Methods
* 	get - returns a promise that resolves to the value of the key
* 	set - delegate task to resolve
* 	resolve - resolves given key to given value
* 	resolveAll - resolves all promised values to a given value
**/
class PromiseMap extends Map {

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
		super.set(key, promise);

		// Delegate to Map
		return super.get(key);
	}

	set(key, value) {
		return this.resolve(key, value);
		// if (key instanceof Object) {
		// 	console.log(`Given key in Promise map is an object. Are you sure you want that?`, key);
		// }
		// if (this.has(key) && !this.resolvers.has(key))
		// 	throw new Error("Given key value was already fulfilled");

		// // If it was promised by a user or by get()
		// if (this.has(key) && this.resolvers.has(key)) {
		// 	// Resolve the promise
		// 	const resolvePromise = this.resolvers.get(key);
		// 	resolvePromise(value);
		// 	this.resolvers.delete(key);
		// 	return true;
		// }

		// // Otherwise, statically resolve the promise
		// return super.set(key, Promise.resolve(value));;
	}

	delete(key) {
		this.resolvers.delete(key);
		return this.delete(key);
	}

	resolve(key, value) {
		if (key instanceof Object)
			console.log(`Given key in Promise map is an object. Are you sure you want that?`, key);

		// If it wasn't a promised key, set it.
		if (!this.has(key)) {
			return super.set(key, Promise.resolve(value));
		}

		const resolvePromise = this.resolvers.get(key);
		if (!resolvePromise) 
			return false;
		// Otherwise, resolve the existing promise
		resolvePromise(value);
		this.resolvers.delete(key);
		return true;
	}

	resolveAll(value) {
		this.resolvers.forEach((resolve) => {
			resolve(value);
		});
		this.resolvers.clear();
	}
}


export {
	PromiseMap,
	getMonthRange,
	sameMonth,
	sameDay,
	getYYYYMMDDFormat
};