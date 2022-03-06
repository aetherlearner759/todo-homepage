'use strict';

class DBObj {
	// Private attributes
	#db;

	constructor() {
	}

	/*
	Opens main_db database and returns a promise containing a boolean value of 
	whether it succeeded or not. 
	If main_db does not exist then it sets up the main_db database
	*/
	async openDB() {

		return new Promise((resolve, reject) => {
			let req = indexedDB.open('main_db');

			req.onsuccess = () => {
				this.#db = req.result;
				return resolve(true);
			};

			req.onerror = () => {
				return reject(false);
			};

			req.onupgradeneeded = (e) => {
				this.#db = e.target.result; 

				// Create object store to store daily tasks
				let todoObjStore = this.#db.createObjectStore('daily_os', { keyPath: 'did', autoIncrement:true });

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
	loadDailyDB(date) {

		return new Promise((resolve) => {

			const array = [];
			date = getYYYYMMDD(date); 

			// Set up transaction
			const trans = this.#db.transaction(['daily_os'], 'readonly');
			
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
					return resolve(array);
				}
			};
		});
	}


	/*
	Given a JSON-formatted item, add the item to the daily objectstore
	*/
	addDailyDB(item) {

		return new Promise((resolve, reject) => {

			const trans = this.#db.transaction(['daily_os'], 'readwrite');
			const req = trans.objectStore('daily_os').add(item);

			req.onsuccess = function(e) {
				item.did = e.target.result;
				return resolve(true);
			};
			trans.oncomplete = function(e) {
				return resolve(true);
			}
			trans.onerror = function(e) {
				return reject(false);
			}
		});
	}


	/*
	Delete a daily from daily objectstore given its id
	*/
	deleteDailyDB(id) {

		return new Promise((resolve, reject) => {
			const trans = this.#db.transaction(['daily_os'], 'readwrite');
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
	toggleCompDailyDB(id) {

		return new Promise((resolve, reject) => {
			const trans = this.#db.transaction(['daily_os'], 'readwrite');
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
}


const mainNameSpace = function() {


// Get DOM objects
const clockTimeEl = document.getElementById("clock-time");
const clockDateEl = document.getElementById("clock-date");
const dailyListEl = document.getElementById("daily-list");
const serviceContainer = document.getElementById("services-container");
const dailyHeaderEl = document.getElementById("daily-header");
const dailyPriorContainer = document.getElementById("daily-add-priority");
const addDailyBtn = document.getElementById("add-daily-btn");
const addDailyContainer = document.getElementById("daily-add-container");

// "global" variables
let db; 
let dailyArray = [];
let selectedDate = new Date();


async function init() {

	addNonDBEventListeners();
	updateClock()
	setInterval(updateClock, 1000)

	db = new DBObj();

	if ( !(await db.openDB()) ) {
		console.log("Database failed to open");
		const errorTodoEl = document.createElement('li');
		errorTodoEl.innerHTML = `
			<span class="todo-name">Failed to Access Dailies</span>
		`;
		dailyListEl.prepend(errorTodoEl);

		return false;
	}
	// Now do stuff with opened database
	addDBEventListeners();

	let req = await db.loadDailyDB(selectedDate);
	if (req) {
		renderDailies(req);
	}
	else {
		alert("Failed to load dailies from database");
	}
	
	

}


function addNonDBEventListeners() {

	// Add click functionality to services dropdown
	document.addEventListener("click", (e) => {
		const isDropdownButton = e.target.matches("#services-btn i");
		const inDropdown = e.target.matches("#services-dropdown");

		if(isDropdownButton) {
			serviceContainer.classList.toggle('active');
		}
		else if (!inDropdown) {
			serviceContainer.classList.remove('active');
		}
	});
}


function addDBEventListeners() {
	// Add click functionality to show add task 
	addDailyBtn.addEventListener("click", () => {
		dailyHeaderEl.classList.toggle("show");
	});

	// Add functionality to select priority stars in add daily
	dailyPriorContainer.addEventListener("click", (e) => {

		if (e.target.id.startsWith("priority")) {
			let priorAmt = e.target.id[8];

			const stars = dailyPriorContainer.querySelectorAll("i");

			stars.forEach(star => {
				if (star.id[8] <= priorAmt) {
					star.classList.add("star-select");
				}
				else {
					star.classList.remove("star-select");
				}
			});

			const val = dailyPriorContainer.querySelector("input");
			val.value = priorAmt;
		}
	});

	// Add daily submit functionality
	addDailyContainer.addEventListener("submit", async (e) => {
		e.preventDefault();

		if (e.target.t.value === "") {
			alert("Please type in the daily's title");
			return;
		}

		let item = {
			title: e.target.t.value,
			subtitle: e.target.s.value,
			date: getYYYYMMDD(selectedDate),
			prior: e.target.p.value,
			comp: false
		};

		let req = await db.addDailyDB(item);
		
		if ( req ) {
			console.log("Successfully added daily");
			e.target.t.value = "";
			e.target.s.value = "";
			e.target.p.value = 3;

			const stars = dailyPriorContainer.querySelectorAll("i");

			stars.forEach(star => {
				if (star.id[8] <= 3) {
					star.classList.add("star-select");
				}
				else {
					star.classList.remove("star-select");
				}
			});
		}
		else {
			console.log("Failed to add daily");
		}
	});
}

function renderDailies(dailyArray) {
	dailyListEl.innerHTML = "";

	if (dailyArray.length === 0) {
		const noDaily = document.createElement('li');

		noDaily.innerHTML = `
			<span class="daily-name">No Dailies</span>	
		`;

		dailyListEl.append(noDaily);

		return false;
	}

	dailyArray.forEach(daily => {

		const dailyEl = document.createElement('li');

		let priorityHTML = "";
		for (let i = 0; i < daily.prior; i++) {
			priorityHTML += `<i class="fa-solid fa-star"></i>`
		}

		dailyEl.innerHTML = `
			<span class="daily-name">
					${daily.title}			
					<span class="daily-subtitle">
						${daily.subtitle}
					</span>
			</span>	


			<span class="daily-priority">
				${priorityHTML}
			</span>	

			<button id="daily-del-btn" class="icon-btn small-btn">
				<i class="fa-solid fa-trash"></i>
			</button>
		`;

		const delbtn = dailyEl.querySelector("#daily-del-btn");
		delbtn.addEventListener("click", () => {
			db.deleteDailyDB(daily.did).then((val) => {
				if (val) {
					dailyEl.remove();
				}
				else {
					console.log("Could not delete daily");
				}
			});
		});

		dailyEl.addEventListener("click", (e) => {
			if (!e.target.matches("#daily-del-btn")) {
				dailyEl.classList.toggle("completed");
				delbtn.classList.toggle("completed");

				db.toggleCompDailyDB(daily.did).then( (val) => {

					if(val) {
					}
					else {
						console.log("Could not toggle complete on daily");
					}

				});
			}
		});

		if (daily.comp) {
			dailyEl.classList.toggle("completed");
			delbtn.classList.toggle("completed");
		}

		dailyListEl.append(dailyEl);
	});

	return true;
}

/*
Updates the clock container with the right time and date
*/
function updateClock() {
	let curDate = new Date()

	let hour = curDate.getHours();
	let min = curDate.getMinutes();
	clockTimeEl.innerText = `${(hour%12 === 0) ? 12 : hour%12} : ${(min < 10) ? "0"+min : min} ${(hour < 12) ? "AM" : "PM"}`

	clockDateEl.innerText = getYYYYMMDD(curDate);
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

// FIXME: Delete this function on deployment
function insertDB() {
	const dates = ["2022-03-06", "2022-03-07", "2022-03-08", "2022-03-09", "2022-03-10", "2022-03-11", "2022-03-12", "2022-02-06", "2022-04-06"];

	let item = {
		title: "",
		subtitle: "",
		date: "",
		prior: "",
		comp: false
	};

	for (let i = 1; i <= 100; i++){
		item.title = "Task " + i;
		item.subtitle = "Subtitle "+ i;
		item.date = dates[Math.floor(Math.random()*dates.length)];
		item.prior = Math.ceil(Math.random()*5);
		item.comp = false;
		db.addDailyDB(item);
	}
}


return {
	init: init,
	deleteDB: deleteDB,
	insertDB: insertDB
} }();


mainNameSpace.init();


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









