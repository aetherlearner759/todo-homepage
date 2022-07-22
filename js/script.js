 'use strict';

import Database from "/js/Database.mjs";
import DailyBuffer from "/js/DailyBuffer.mjs";
import DueBuffer from "/js/DueBuffer.mjs";
import Renderer from "/js/Renderer.mjs";
import {getYYYYMMDDFormat} from "/js/utils.mjs";

(async function(){

// Namespace for storing DOM Elements
const DOM = (function() {
	const DOM_objects = {
		// FIXME: how should i go about this?

		// Set an another name for an DOM object
		setAlias(prop_name, id) {
			DOM_objects[prop_name] = this[id];
		}
	};

	const proxy = new Proxy(DOM_objects, {
		// If given property does not exist, get it as DOM object by ID using prop as ID. 
		get(target, prop, receiver) {
			if (!Reflect.has(target, prop)) {
				const element = document.getElementById(prop);
				if (!element)
					throw new Error(`There is no DOM object with ID ${prop}`);
				Reflect.set(target, prop, element);
			}
			return Reflect.get(...arguments);
		}
	});

	return proxy;
})();

DOM.setAlias("dailyList", "daily-list");
DOM.setAlias("dailyHeader", "daily-header");
DOM.setAlias("dailyAddPriority", "daily-add-priority");
DOM.setAlias("addDailyBtn", "add-daily-btn");
DOM.setAlias("addDueBtn", "add-duedate-btn");
DOM.setAlias("dailyAddContainer", "daily-add-container");
DOM.setAlias("dueAddContainer", "due-add-container");
DOM.setAlias("sortDateaddedBtn", 'sort-dateadded-btn');
DOM.setAlias("sortPriorityBtn", 'sort-priority-btn');
DOM.setAlias("sortDuedateBtn", 'sort-duedate-btn');
DOM.setAlias("filterCompBtn", 'filter-comp-btn');
DOM.setAlias("calendar", "calendar-container");
DOM.setAlias("dateCellContainer", "datecell-container");
DOM.setAlias("calYM", "calendar-ym");

// FIXME: some font awesome icons don't work. 
// Maybe remove dependency on font awesome because they suck

// State variables
const selectedDate = new Date();
const db = new Database();


// FIXME: Database would make more sense as a class than an object
try {
	await db.open("main_db");
}
catch(error) {
	console.err(error);
}
//db.deleteDB();
//db.insertDB();


const dailyBuffer = new DailyBuffer(db);
const dueBuffer = new DueBuffer(db);

const renderer = new Renderer(DOM, selectedDate, dailyBuffer, dueBuffer);

renderer.startClock();
renderer.renderDailyList();
renderer.renderCalendar();


/* Event Listeners */
// Add click functionality to services dropdown
document.addEventListener("click", (e) => {
	const isDropdownButton = e.target.matches("#services-btn i");
	const inDropdown = e.target.matches("#services-dropdown");

	if(isDropdownButton) {
		DOM["services-container"].classList.toggle('active');
	}
	else if (!inDropdown) {
		DOM["services-container"].classList.remove('active');
	}
});

// Calendar left and right button functionality
document.querySelector("#cal-left").addEventListener("click", () => {
	selectedDate.setDate(0);

	// Change calendar year and month
	DOM.calYM.innerText = getYYYYMMDDFormat(selectedDate).slice(0, -3);

	renderer.renderDailyList();
	renderer.renderCalendar();
});

document.querySelector("#cal-right").addEventListener("click", () => {
	selectedDate.setMonth(selectedDate.getMonth()+1);
	selectedDate.setDate(1);

	// Change calendar year and month
	DOM.calYM.innerText = getYYYYMMDDFormat(selectedDate).slice(0, -3);

	renderer.renderDailyList();
	renderer.renderCalendar();
});

// Functionality to showing add task tab
DOM.addDailyBtn.addEventListener("click", () => {
	if (!DOM.dailyHeader.classList.contains("show")) {
		DOM.dailyAddContainer.classList.remove("remove");
		DOM.dueAddContainer.classList.add("remove");
	}
	DOM.dailyHeader.classList.toggle("show");
});

// Functionality for showing add due date tab
DOM.addDueBtn.addEventListener("click", () => {
	if (!DOM.dailyHeader.classList.contains("show")) {
		DOM.dailyAddContainer.classList.add("remove");
		DOM.dueAddContainer.classList.remove("remove");
	}
	DOM.dailyHeader.classList.toggle("show");
});

// Functionality to select priority stars in add daily
DOM.dailyAddPriority.addEventListener("click", (e) => {

	if (e.target.id.startsWith("priority")) {
		let priorAmt = e.target.id[8];

		const stars = DOM.dailyAddPriority.querySelectorAll("i");

		stars.forEach(star => {
			if (star.id[8] <= priorAmt) {
				star.classList.add("star-select");
			}
			else {
				star.classList.remove("star-select");
			}
		});

		const val = DOM.dailyAddPriority.querySelector("input");
		val.value = priorAmt;
	}
});

// Add daily submit functionality
DOM.dailyAddContainer.addEventListener("submit", async (e) => {
	e.preventDefault();

	if (e.target.t.value === "") {
		alert("Please type in the daily's title");
		return;
	}

	let item = {
		title: e.target.t.value,
		subtitle: e.target.s.value,
		date: selectedDate,
		prior: e.target.p.value,
		comp: false
	};

	dailyBuffer.addDaily(item)
	.then(() => {
		console.log("Successfully added daily");
		e.target.t.value = "";
		e.target.s.value = "";
		e.target.p.value = 3;

		const stars = DOM.dailyAddPriority.querySelectorAll("i");

		// FIXME: coupled code. Maybe iterate over stars from left to right?
		stars.forEach(star => {
			if (star.id[8] <= 3) {
				star.classList.add("star-select");
			}
			else {
				star.classList.remove("star-select");
			}
		});


		// FIXME: this will re-render the daily list which might be unnecessarily expensive
		renderer.renderDailyList();
		renderer.renderCalendar();

	})
	.catch((reason) => {
		throw reason;
	});
});

// Add duedate functionality
DOM.dueAddContainer.addEventListener("submit", async (e) => {
	e.preventDefault();

	// Check if all inputs are filled
	if ( e.target.t.value === "" || e.target.da.value === "" || e.target.ti.value === "") {
		// FIXME: don't like alert. 
		alert("Please fill in everything");
		return;
	}

	let item = {
		title: e.target.t.value,
		date: new Date(`${e.target.da.value}T${e.target.ti.value}`),
		icon: e.target.icon.value
	};

	dueBuffer.addDue(item)
	.then(() => {
		console.log("Successfully added due");
		e.target.t.value = "";
		e.target.da.value = "";
		e.target.ti.value = "";

		// FIXME: this will re-render the daily list which might be unnecessarily expensive
		renderer.renderDailyList();
		renderer.renderCalendar();

	})
	.catch((reason) => {
		throw reason;
	});
});

// Filter completed
DOM.filterCompBtn.addEventListener("click", (e) => {
	DOM.filterCompBtn.classList.toggle("selected");

	renderer.filterCompleted(DOM.filterCompBtn.classList.contains("selected"));
	renderer.renderDailyList();
});

// // Sort buttons functionalities
DOM.sortDateaddedBtn.addEventListener("click", (e) => {
	// FIXME: for each sort button I add, I have to manually deselect all of them. Not DRY
	DOM.sortDateaddedBtn.classList.add("selected");
	DOM.sortDuedateBtn.classList.remove("selected");			
	DOM.sortPriorityBtn.classList.remove("selected");

	renderer.setSortMode(Renderer.SORT_DATE_ADDED);
	renderer.renderDailyList();
});

DOM.sortPriorityBtn.addEventListener("click", (e) => {
	DOM.sortDateaddedBtn.classList.remove("selected");
	DOM.sortDuedateBtn.classList.remove("selected");			
	DOM.sortPriorityBtn.classList.add("selected");

	renderer.setSortMode(Renderer.SORT_PRIORITY);
	renderer.renderDailyList();});

DOM.sortDuedateBtn.addEventListener("click", (e) => {
	DOM.sortDateaddedBtn.classList.remove("selected");
	DOM.sortDuedateBtn.classList.add("selected");			
	DOM.sortPriorityBtn.classList.remove("selected");

	renderer.setSortMode(Renderer.SORT_DUEDATE);
	renderer.renderDailyList();
});



})();