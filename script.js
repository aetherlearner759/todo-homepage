'use strict';
// ^ Optimization to code 

class DBObj {
	// Private attributes
	static #db;

	constructor() {
	}

	/*
	Opens main_db database and returns a promise containing a boolean value of 
	whether it succeeded or not. 
	If main_db does not exist then it sets up the main_db database
	*/
	async open() {

		return new Promise((resolve, reject) => {
			let req = indexedDB.open('main_db');

			req.onsuccess = () => {
				DBObj.#db = req.result;
				return resolve(true);
			};

			req.onerror = () => {
				return reject(false);
			};

			req.onupgradeneeded = (e) => {
				DBObj.#db = e.target.result; 

				// Create object store to store daily tasks
				let todoObjStore = DBObj.#db.createObjectStore('daily_os', { keyPath: 'did', autoIncrement:true });

				// Specify schema of the daily object store
				todoObjStore.createIndex('title', 'title', { unique:false });
				todoObjStore.createIndex('subtitle', 'subtitle', { unique:false });
				todoObjStore.createIndex('date', 'date', { unique: false });
			  	todoObjStore.createIndex('prior', 'prior', { unique: false });
				todoObjStore.createIndex('comp', 'comp', { unique: false });

				// Create object store to store due dates
				let dueObjStore = DBObj.#db.createObjectStore('due_os', { keyPath: 'ddid', autoIncrement: true });

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


	/*
	Given JS date object, load daily into given array.
	If success return true
	*/
	loadDaily(array, date) {

		return new Promise((resolve) => {

			array.length = 0;
			date = getYYYYMMDD(date); 

			// Set up transaction
			const trans = DBObj.#db.transaction(['daily_os'], 'readonly');
			
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
					return resolve(true);
				}
			};
		});
	}

	/*
	Given JS date object, load due dates of date month into given array.
	If success return true
	*/
	loadDues(array, date) {

		return new Promise((resolve) => {

			// Empty array
			array.length = 0;
			// Get first day of month and last day of month
			let firstDate = new Date(date.getFullYear(), date.getMonth(), 1);
			firstDate = getYYYYMMDD(firstDate); 
			let secondDate = new Date(date.getFullYear(), date.getMonth()+1, 0);
			secondDate = getYYYYMMDD(secondDate);

			// Set up transaction
			const trans = DBObj.#db.transaction(['due_os'], 'readonly');
			
			// Set up cursor
			const dateIndex = trans.objectStore('due_os').index('duedate');
			const keyRange = IDBKeyRange.bound(firstDate, secondDate);
			const cursorReq = dateIndex.openCursor(keyRange);

			cursorReq.onsuccess = (e) => {
				const cursor = e.target.result;
				if (cursor) {
					const due = cursor.value;
					array.push(due);
					cursor.continue();
				}	
				else {
					return resolve(true);
				}
			};
		});
	}


	/*
	Given a JSON-formatted item, add the item to the daily objectstore
	*/
	addDaily(item) {

		return new Promise((resolve, reject) => {

			const trans = DBObj.#db.transaction(['daily_os'], 'readwrite');
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
	deleteDaily(id) {

		return new Promise((resolve, reject) => {
			const trans = DBObj.#db.transaction(['daily_os'], 'readwrite');
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
	toggleCompDaily(id) {

		return new Promise((resolve, reject) => {
			const trans = DBObj.#db.transaction(['daily_os'], 'readwrite');
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


	/*
	Given a JSON-formatted duedate item, add the item to the duedate objectstore
	*/
	addDue(item) {
		return new Promise((resolve, reject) => {

			const trans = DBObj.#db.transaction(['due_os'], 'readwrite');
			const req = trans.objectStore('due_os').add(item);

			req.onsuccess = function(e) {
				item.ddid = e.target.result;
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
	Delete a due from duedate objectstore given its id
	*/
	deleteDue(id) {

		return new Promise((resolve, reject) => {
			const trans = DBObj.#db.transaction(['due_os'], 'readwrite');
			const req = trans.objectStore('due_os').delete(id);

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
	Updates given due given id
	*/
	updateDue(id, newtitle = undefined, newdate = undefined, newtime = undefined, icon=undefined) {
		return new Promise((resolve, reject) => {
			let item = {};
			item.ddid = id;
			if (newtitle) {
				item.title = newtitle;
			}
			if (newdate) {
				item.duedate = newdate;
			}
			if (newtime) {
				item.duetime = newtime;
			}
			if (icon) {
				item.icon = icon; 
			}

			const trans = DBObj.#db.transaction(['due_os'], 'readwrite');
			const req = trans.objectStore('due_os').put(item);

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


	// FIXME: Delete this function on deployment
	deleteDB() {
		var request = indexedDB.deleteDatabase('main_db');

		request.onsuccess = function() {
			console.log("Database deleted");
		}

		request.onerror = function() {
			console.log("Database failed to be deleted");
		}
	}

	// FIXME: Delete this function on deployment
	insertDB() {
		const dates = ["2022-03-27", "2022-03-01", "2022-03-31", "2022-02-03", "2022-04-03", "2022-03-15", "2021-03-11", "2023-03-30"];

		let due = { 
			title: "",
			duedate: "",
			duetime: "",
			icon: "",
		}

		for (let i = 1; i <= 10; i++) {
			due.title = "Due " + i;
			due.duedate = dates[Math.floor(Math.random()*dates.length)];
			due.duetime = "05:00";
			due.icon = "square";
			this.addDue(due);
		}



		// const dates = ["2022-03-13", "2022-03-14", "2022-03-15", "2022-03-16", "2022-03-17", "2022-03-18", "2022-03-20", "2022-02-13", "2022-04-13"];

		// let item = {
		// 	title: "",
		// 	subtitle: "",
		// 	date: "",
		// 	prior: "",
		// 	comp: false
		// };

		// for (let i = 1; i <= 100; i++){
		// 	item.title = "Task " + i;
		// 	item.subtitle = "Subtitle "+ i;
		// 	item.date = dates[Math.floor(Math.random()*dates.length)];
		// 	item.prior = Math.ceil(Math.random()*5);
		// 	item.comp = false;
		// 	this.addDaily(item);
		// }
	}

}


class DailyList {
	// DOM objects
	static #dailyListEl = document.getElementById("daily-list");
	static #dailyHeaderEl = document.getElementById("daily-header");
	static #dailyPriorContainer = document.getElementById("daily-add-priority");
	static #addDailyBtn = document.getElementById("add-daily-btn");
	static #addDueBtn = document.getElementById("add-duedate-btn");
	static #addDailyContainer = document.getElementById("daily-add-container");
	static #addDueContainer = document.getElementById("due-add-container");
	static #sortAddedBtn = document.getElementById('sort-dateadded-btn');
	static #sortPriorBtn = document.getElementById('sort-priority-btn');
	static #sortDueBtn = document.getElementById('sort-duedate-btn');
	static #filterCompBtn = document.getElementById('filter-comp-btn');
	#db;
	#calendar = undefined;
	#dailyArray = [];
	length = 0;
	#date;
	// 0 for sort by order added, 1 for priority, 2 for due date
	#sortMode = 0;
	#filterComp = false;

	constructor(db, date = new Date()) {
		this.#db = db;
		this.#date = date;

		this.setEventListeners();
	}

	sync(calendar) {
		this.#calendar = calendar;
	}


	push(daily) {
		this.#dailyArray.push(daily);
		this.length++;
	}


	getCompare(sortMode = this.#sortMode) {
		let compare;
		// Sort by order added
		if (sortMode === 0) {
			compare = (a,b) => {
				return b.did - a.did;
			}
		}
		// Sort by priority rating
		else if (sortMode == 1) {
			compare = (a,b) => {
				return b.prior - a.prior;
			}
		}
		// Sort by due date
		else if (sortMode == 2) {
			// FIXME: hardcoded due date sort for now
			compare = (a, b) => {
				return a.did - b.did;
			}
		}

		return compare;
	}

	async load(date = this.#date) {
		this.#date = date;

		let req = await this.#db.loadDaily(this.#dailyArray, this.#date);
		if (!req) {
			console.log("Failed to load dailies");
			return false;
		}
		this.length = this.#dailyArray.length;
		return true;
	}


	setEventListeners() {
		// Add click functionality to show add task 
		DailyList.#addDailyBtn.addEventListener("click", () => {
			if (!DailyList.#dailyHeaderEl.classList.contains("show")) {
				DailyList.#addDailyContainer.classList.remove("remove");
				DailyList.#addDueContainer.classList.add("remove");
				
			}
			DailyList.#dailyHeaderEl.classList.toggle("show");
			
		});
		// Click functionality for showing add due date
		DailyList.#addDueBtn.addEventListener("click", () => {
			if (!DailyList.#dailyHeaderEl.classList.contains("show")) {
				DailyList.#addDailyContainer.classList.add("remove");
				DailyList.#addDueContainer.classList.remove("remove");
				
			}

			DailyList.#dailyHeaderEl.classList.toggle("show");
		});

		// Add functionality to select priority stars in add daily
		DailyList.#dailyPriorContainer.addEventListener("click", (e) => {

			if (e.target.id.startsWith("priority")) {
				let priorAmt = e.target.id[8];

				const stars = DailyList.#dailyPriorContainer.querySelectorAll("i");

				stars.forEach(star => {
					if (star.id[8] <= priorAmt) {
						star.classList.add("star-select");
					}
					else {
						star.classList.remove("star-select");
					}
				});

				const val = DailyList.#dailyPriorContainer.querySelector("input");
				val.value = priorAmt;
			}
		});

		// Add daily submit functionality
		DailyList.#addDailyContainer.addEventListener("submit", async (e) => {
			e.preventDefault();

			if (e.target.t.value === "") {
				alert("Please type in the daily's title");
				return;
			}

			let item = {
				title: e.target.t.value,
				subtitle: e.target.s.value,
				date: getYYYYMMDD(this.#date),
				prior: e.target.p.value,
				comp: false
			};

			let req = await this.#db.addDaily(item);
			
			if ( req ) {
				console.log("Successfully added daily");
				e.target.t.value = "";
				e.target.s.value = "";
				e.target.p.value = 3;

				const stars = DailyList.#dailyPriorContainer.querySelectorAll("i");

				stars.forEach(star => {
					if (star.id[8] <= 3) {
						star.classList.add("star-select");
					}
					else {
						star.classList.remove("star-select");
					}
				});

				
				// Remove "no dailies" 
				if (this.length === 0) {
					DailyList.#dailyListEl.innerHTML = ''; 
				}

				this.pushRenderDaily(item);
				// Update calendar
				this.#calendar.updateCount(this.#date.getDate(), "addtodo");

				

			}
			else {
				console.log("Failed to add daily");
			}
		});
		
		// Add duedate functionality
		DailyList.#addDueContainer.addEventListener("submit", async (e) => {
			e.preventDefault();

			// Check if all inputs are filled
			if ( e.target.t.value === "" || e.target.da.value === "" || e.target.ti.value === "") {
				alert("Please fill in everything");
				return;
			}

			let item = {
				title: e.target.t.value,
				duedate: e.target.da.value,
				duetime: e.target.ti.value,
				icon: e.target.icon.value
			};

			let req = await this.#db.addDue(item);

			if (req) {
				e.target.t.value = "";
				e.target.da.value = "";
				e.target.ti.value = "";
				e.target.icon.value = "square";

				// Update calendar

				// Update daily list
			}
			else {
				console.log("Failed to add due date");
			}
		});


		// Filter completed
		DailyList.#filterCompBtn.addEventListener("click", (e) => {
			DailyList.#filterCompBtn.classList.toggle("selected");
			this.#filterComp = !this.#filterComp;

			this.render();
		});
		
		// Sort buttons functionalities
		DailyList.#sortAddedBtn.addEventListener("click", (e) => {
			DailyList.#sortAddedBtn.classList.add("selected");
			DailyList.#sortDueBtn.classList.remove("selected");			
			DailyList.#sortPriorBtn.classList.remove("selected");

			this.#sortMode = 0
			this.sortDailies()
			this.render()
		});

		DailyList.#sortPriorBtn.addEventListener("click", (e) => {
			DailyList.#sortPriorBtn.classList.add("selected");
			DailyList.#sortDueBtn.classList.remove("selected");
			DailyList.#sortAddedBtn.classList.remove("selected");

			this.#sortMode = 1
			this.sortDailies()
			this.render()
		});

		DailyList.#sortDueBtn.addEventListener("click", (e) => {
			DailyList.#sortDueBtn.classList.add("selected");
			DailyList.#sortAddedBtn.classList.remove("selected");
			DailyList.#sortPriorBtn.classList.remove("selected");

			this.#sortMode = 2
			this.sortDailies()
			this.render()
		});
	}


	render() {
		DailyList.#dailyListEl.innerHTML = "";

		if (this.length === 0) {
			const noDaily = document.createElement('li');

			noDaily.innerHTML = `
				<span class="daily-name">No Dailies</span>	
			`;

			DailyList.#dailyListEl.append(noDaily);

			return false;
		}

		this.#dailyArray.forEach(daily => {

			if ( !(this.#filterComp && daily.comp) ) {
				DailyList.#dailyListEl.append(this.getDailyEl(daily));
			}

		});

		return true;
	}


	pushRenderDaily(daily) {

		let compare = this.getCompare();
		this.length++;

		if (this.length === 0) {
			this.push(daily);
		}

		for (let i = 0; i < this.#dailyArray.length; i++) {

			if (this.#dailyArray.comp || compare(this.#dailyArray[i], daily) > 0) {
				this.#dailyArray.splice(i, 0, daily);
				DailyList.#dailyListEl.insertBefore(this.getDailyEl(daily), DailyList.#dailyListEl.children[i]);
				return;
			}
		}

		this.#dailyArray.push(daily);
		DailyList.#dailyListEl.append(this.getDailyEl(daily));
		return;

	}


	getDailyEl(daily) {
		const dailyEl = document.createElement('li');
		dailyEl.id = daily.did;

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
		</button> `;

		const delbtn = dailyEl.querySelector("#daily-del-btn");
		delbtn.addEventListener("click", async () => {
			if ( !(await this.#db.deleteDaily(daily.did)) ) {
				console.log("Could not delete daily");
				return;
			}

			dailyEl.remove();
			this.length--;
			let day = parseInt(daily.date.substring(8, 10));
			this.#calendar.updateCount(day, "deldaily", daily.comp);

		});

		dailyEl.addEventListener("click", async (e) => {
			if (!e.target.parentNode.matches("#daily-del-btn")) {
				dailyEl.classList.toggle("completed");
				delbtn.classList.toggle("completed");

				if ( !(await this.#db.toggleCompDaily(daily.did)) ) {
					console.log("Could not toggle complete on daily");
					return;
				}

				let comp = dailyEl.classList.contains("completed");

				let day = parseInt(daily.date.substring(8, 10));
				this.#calendar.updateCount(day, "togglecomp", comp);
			}
		});

		if (daily.comp) {
			dailyEl.classList.toggle("completed");
			delbtn.classList.toggle("completed");
		}

		return dailyEl;
	}



	sortDailies() {

		if (this.length <= 1) {
			return;
		}

		// Partition the array such that left half are not completed and other half completed
		let lastNC = -1;

		for (let i = 0; i < this.length; i++) {
			if ( !(this.#dailyArray[i].comp) ) {
				lastNC++;
				let temp = this.#dailyArray[lastNC];
				this.#dailyArray[lastNC] = this.#dailyArray[i];
				this.#dailyArray[i] = temp;
			}
		}

		let compare = this.getCompare();

		// Sort non completed tasks by priority
		insertionSort(this.#dailyArray, 0, lastNC, compare);
		// Sort completed tasks by priority
		insertionSort(this.#dailyArray, lastNC+1, this.length-1, compare);
	}

}

class DueDates {

	#db; 
	#month;
	#dueArray = [];
	length = 0;


	constructor(db, date = new Date()) {
		this.#db = db;
		this.#month = date;
	}

	async load(date = this.#month) {
		this.#month = date;

		let req = await this.#db.loadDues(this.#dueArray, date);
		this.length = this.#dueArray.length;

		if (req) {
			return true;
		}
		else {
			return false;
		}
	}

	async getDues(array, date) {

		date = getYYYYMMDD(date);

		for (let i = 0; i < this.length; ++i) {
			if (this.#dueArray[i].duedate === date) {
				array.push(this.#dueArray[i]);
			}
		}
	}

}


class Calendar {
	// DOM objects
	static #calEl = document.getElementById("calendar-container");
	static #calYMEl = document.getElementById("calendar-ym");
	#db;
	#dailyList = undefined;
	#dueList = undefined;
	#month = new Date();

	constructor(db, date) {
		this.#db = db;
		this.#month = date;
		Calendar.#calYMEl.innerText = getYYYYMMDD(date).substring(0,7);
		this.setEventListeners();
	} 

	sync(dailyList, dueDates) {
		this.#dailyList = dailyList;
		this.#dueList = dueDates;
	}


	setEventListeners() {

		Calendar.#calEl.querySelector("#cal-left").addEventListener("click", async () => {
			this.#month.setDate(0);

			// Change calendar year and month
			Calendar.#calYMEl.innerText = getYYYYMMDD(this.#month).substring(0,7);

			// Load new day and due date
			if ( !(await this.#dailyList.load(this.#month)) || !(await this.#dueList.load(this.#month)) ) {
				console.log("Failure")
				return;
			}

			await this.set();

			this.#dailyList.sortDailies();
			this.#dailyList.render();
		});

		Calendar.#calEl.querySelector("#cal-right").addEventListener("click", async () => {
			this.#month.setMonth(this.#month.getMonth() + 1);
			this.#month.setDate(1);

			// Change calendar year and month
			Calendar.#calYMEl.innerText = getYYYYMMDD(this.#month).substring(0,7);
			await this.set();

			// Load new day and due date
			if ( !(await this.#dailyList.load(this.#month)) || !(await this.#dueList.load(this.#month)) ) {
				console.log("Failure")
				return;
			}

			await this.set();

			this.#dailyList.sortDailies();
			this.#dailyList.render();
		});
	}


	async set(curDate = this.#month) {
		// First first date and last month of the current month
		const firstDate = new Date(curDate.getFullYear(), curDate.getMonth(), 1);
		const lastDate = new Date(curDate.getFullYear(), curDate.getMonth()+1, 0);

		// Remove all date cells in the calendar. tldr: reset calendar
		const oldDateCells = Calendar.#calEl.querySelectorAll(".date-cell");
		oldDateCells.forEach(oldDateCell => {
			oldDateCell.remove();
		});

		const start = firstDate.getDay();
		const numDays = lastDate.getDate();

		// Loop thorugh each day of the current month
		for (let i = start; i < start+numDays; i++) {

			// Create our date cell
			const dateCell = document.createElement('div');
			dateCell.id = `date${i+1-start}`;
			dateCell.classList.add('date-cell');

			// Properly align date cell in the grid
			let row = 3 + Math.floor(i/7);
			let col = i%7 + 1;
			dateCell.style.gridArea = `${row}/${col}/${row}/${col}`;

			// Get date object for the date cell
			let date = new Date(curDate.getFullYear(), curDate.getMonth(), i+1-start);
			// Load the data
			let dailies = [];
			if( !(await this.#db.loadDaily(dailies, date)) ) {
				console.log("Failed to load dailiy");
				dateCell.innerHTML = `
					${i+1-start}
					<span class="count-container">
					Failed to load
					</span>
				`;
				continue;
			}

			// Count completed dailies and uncompleted
			let compCount = 0;
			let todoCount = 0;
			for (let j = 0; j < dailies.length; j++) {
				if (dailies[j].comp) {
					compCount++;
				}
				else {
					todoCount++;
				}
			}

			// Get duedates
			let duedatesHTML = "";
			let duearray = [];

			await this.#dueList.getDues(duearray, date);
			
			// Add the due icons to calendar
			duearray.forEach( (due) => {
				duedatesHTML += `<i id="${due.ddid}" title="${due.title}" class="fa-solid fa-${due.icon}"></i>`;
			});


			// Set date cell HTML 
			dateCell.innerHTML = `
				${i+1-start}
				<span class="duedates-container">
					${duedatesHTML}
				</span>
				<span class="count-container">
					<span id="count-todo" class="count-todo">
					<b class="count-num">${(todoCount > 0) ? todoCount : ""}</b> 
					</span>

					<span id="count-comp" class="count-comp">
					<b class="count-num">${(compCount > 0) ? compCount : ""}</b> 
					</span>
				</span>

			`;


			// Click functionality
			dateCell.addEventListener("click", (e) => {

				// Correctly set selected class 
				if (dateCell.classList.contains("selected")) {
					return;
				}

				const oldSelectedEl = Calendar.#calEl.querySelector(".selected");
				if (oldSelectedEl) {
					oldSelectedEl.classList.remove('selected');
				}
				dateCell.classList.add("selected");


				// Update daily list
				this.#dailyList.load(date).then( () => {
					this.#dailyList.sortDailies();
					this.#dailyList.render();
				});

			});


			// Select the date cell that is the current date
			if(i+1-start == curDate.getDate()) {
				dateCell.classList.add("selected");
			}

			Calendar.#calEl.appendChild(dateCell);
		}
	}


	updateCount(day, mode, comp = true) {

		const countContainer = Calendar.#calEl.querySelector(`#date${day} .count-container`);

		if (mode === "addtodo") {

			this.addCount(countContainer, true);
			
		}
		else if (mode === "deldaily" && comp) {
			
			this.removeCount(countContainer, false);
			
		}
		else if (mode === "deldaily") {
			
			this.removeCount(countContainer, true);
			
		}
		// Toggled a uncompleted to completed
		else if (mode === "togglecomp" && comp) {

			// Add one to completed
			this.addCount(countContainer, false);
			// Take one out from todo
			this.removeCount(countContainer, true);
		}
		else if (mode === "togglecomp") {

			// Add one to todo
			this.addCount(countContainer, true);
			// Take one out from comp
			this.removeCount(countContainer, false);
		}
	}


	addCount(container, todo = true) {
		const countainer = container.querySelector(`#count-${todo ? "todo" : "comp"}`);
		const count = countainer.querySelector('b');

		if (count.innerText > 0) {
			count.innerText = parseInt(count.innerText) + 1;
		}
		else {
			countainer.innerHTML = `
				<b class="count-num">1</b>
			`;
		}
	}

	removeCount(container, todo = true) {
		const countainer = container.querySelector(`#count-${todo ? "todo" : "comp"}`);
		const count = countainer.querySelector('b');

		if (count.innerText > 1) {
			count.innerText = parseInt(count.innerText) - 1;
		}
		else {
			countainer.innerHTML = `
				<b class="count-num"></b>
			`;
		}
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
const sortAddedBtn = document.getElementById('sort-dateadded-btn');
const sortPriorBtn = document.getElementById('sort-priority-btn');
const sortDueBtn = document.getElementById('sort-duedate-btn');


// "global" variables
let db; 
let dailyArray = [];
let selectedDate = new Date();
// 0 = Sort by added order, 1 = sort by priority, 2 = sort by duedate
let sortMode = 0


async function init() {

	addNonDBEventListeners();
	updateClock()
	setInterval(updateClock, 1000)

	db = new DBObj();

	if ( !(await db.open()) ) {
		console.log("Database failed to open");
		const errorTodoEl = document.createElement('li');
		errorTodoEl.innerHTML = `
			<span class="todo-name">Failed to Access Dailies</span>
		`;
		const dailyListEl = document.getElementById("daily-list");
		dailyListEl.prepend(errorTodoEl);

		return false;
	}
	// Now do stuff with opened database

	const dailyList = new DailyList(db, selectedDate);
	const calendar = new Calendar(db, selectedDate);
	const dueDates = new DueDates(db, selectedDate);
	dailyList.sync(calendar);
	calendar.sync(dailyList, dueDates);

	// Load today's daily list and render if possible
	if ( !(await dailyList.load()) || !(await dueDates.load()) ) {
		console.log("Failure")
		return;
	}

	dailyList.sortDailies();
	dailyList.render();

	// Load the calendar
	calendar.set();
	
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


function deleteDB() {
	db.deleteDB();
}

function insertDB() {
	db.insertDB();

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


function insertionSort(array, start_index, end_index, compare) {

	for (let i = start_index+1; i <= end_index; i++) {

		let key = array[i];
		let j = i-1;

		while (j >= start_index && compare(key, array[j]) < 0) {
			array[j+1] = array[j];
			j--;
		}
		array[j+1] = key;
	}

}

