'use strict';
import DailyBuffer from "/js/DailyBuffer.mjs";
import DueBuffer from "/js/DueBuffer.mjs";
import { getYYYYMMDDFormat, sameDay } from "/js/utils.mjs";



/**
* A singleton Renderer class. This handles the dynamic rendering of the UI in index.html
* Methods:
* 	filterCompleted - sets a flag that filters out completed dailies
* 	setSortMode - sets a flag that determines the order in which dailies are displayed
* 	renderDailyList - renders the dailies onto the daily list
* 	renderCalendar
* 	startClock
**/
class Renderer {

	static {
		this.dailyTemplateElement = document.createElement("template");
		this.dailyTemplateElement.innerHTML = 
		`<li>
			<span class="daily-name"> </span>	
			<span class="daily-subtitle"> </span>

			<span class="daily-countdown"></span>

			<span class="daily-priority"></span>	

			<button id="daily-del-btn" class="icon-btn small-btn">
				<i class="fa-solid fa-trash"></i>
			</button>
		</li>`;
	}

	static {
		this.dateCellTemplateElement = document.createElement("template");
		this.dateCellTemplateElement.innerHTML = 
		`<div class="date-cell">
			<span class="date-num"></span>
			<span class="duedates-container">
			</span>
			<span class="count-container">
				<span id="count-todo" class="count-todo"></span>
				<span id="count-comp" class="count-comp"></span>
			</span>
		</div>`;
	}

	static {
		this.dueIconTemplateElement = document.createElement("template");
		this.dueIconTemplateElement.innerHTML =
		`
		<i id="" title="" class="fa-solid"></i>
		`;
	}

	static SORT_DATE_ADDED = "SORT_DATE_ADDED";
	static SORT_PRIORITY = "SORT_PRIORITY";
	static SORT_DUEDATE = "SORT_DUEDATE";


	constructor(DOM, date, dailyBuffer, dueBuffer) {
		// Singleton support 
		if (Renderer._instance) {
	      throw new Error("Singleton classes can't be instantiated more than once.");
	    }
	    Renderer._instance = this;

		this.DOM = DOM;
		this.selectedDate = date;
		this.dailyBuffer = dailyBuffer;
		this.dueBuffer = dueBuffer;
		this.filter = false;
		this.setSortMode(Renderer.SORT_DATE_ADDED);
	}

	// Sets a flag that filters out completed dailies
	filterCompleted(value) {
		this.filter = value;
	}

	// Sets a flag that determines the order in which dailies are displayed
	setSortMode(mode) {
		switch(mode) {
			case Renderer.SORT_DATE_ADDED:
				this.sort = function(daily1, daily2) {
					if (daily1.comp && !daily2.comp)
						return 1;
					if (daily2.comp && !daily1.comp)
						return -1;
					return daily2.date - daily1.date;
				}
				break;
			case Renderer.SORT_PRIORITY:
				this.sort = function(daily1, daily2) {
					if (daily1.comp && !daily2.comp)
						return 1;
					if (daily2.comp && !daily1.comp)
						return -1;
					return daily2.prior - daily1.prior;
				}
				break;
			case Renderer.SORT_DUEDATE:
				this.sort = function(daily1, daily2) {
					return 0;
					// return daily1.due - daily2.date;
				}
				break;
			default:
				throw new Error(`Unexpect mode, ${mode}, given`);
		}
	}

	#getDailyElement(daily) {

		const dailyElement = Renderer.dailyTemplateElement.content.cloneNode(true).children[0];
		dailyElement.id = `date${daily.did}`;

		// Insert appropriate number of priority stars
		const priorityStars = `<i class="fa-solid fa-star"></i>`;
		// FIXME: HTML needs to be better
		dailyElement.querySelector(".daily-name").innerText = daily.title;
		dailyElement.querySelector(".daily-subtitle").innerText = daily.subtitle;
		dailyElement.querySelector(".daily-priority").innerHTML = priorityStars.repeat(daily.prior);

		// Set up appropriate completion status
		if (daily.comp) {
			dailyElement.classList.toggle("completed");
		}

		this.dueBuffer.getDuesFromTitle(daily.title).then((dues) => {

			// Use the most recent due date item 
			dues.sort((due1, due2) => { return due1.date - due2.date; });
			const dueItem = dues[dues.length-1];

			if (dueItem) {

				const countdownElm = dailyElement.querySelector(".daily-countdown");
				let dueDateObj = due.date;

				function updateCountdown() {
					const timeRemaining = dueDateObj - new Date();

					if (timeRemaining > 0) {
						let hours = Math.floor(timeRemaining/3600000);
						let days = Math.floor(hours/24);

						countdownElm.innerText = `${days > 0 ? days+" days" : ""} ${hours%24} hours due`;
					}
					else {
						countdownElm.innerText = "Overdue";
					}
				}

				updateCountdown();
				// FIXME: how do we prevent resource leak here?
				// Update this every 15 minutes
				//setInterval(900000, updateCountdown);
			}

		});

		// Set up event listeners
		const delbtn = dailyElement.querySelector("#daily-del-btn");
		delbtn.addEventListener("click", async () => {

			this.dailyBuffer.removeDaily(daily)
			.then(() => {
				// Update our daily list
				dailyElement.remove();
				// FIXME: Update calendar
				this.renderCalendar();
			})
			// FIXME: no error handling
			.catch((error) => {
				throw error;
			});
		});

		dailyElement.addEventListener("click", async (e) => {
			if (!e.target.parentNode.matches("#daily-del-btn")) {

				this.dailyBuffer.toggleDailyComp(daily).then(() => {
					dailyElement.classList.toggle("completed");
					this.renderCalendar();
				});
			}
		});

		return dailyElement;
	}

	renderDailyList() {

		this.DOM["dailyList"].replaceChildren();

		this.dailyBuffer.getDailiesFromDate(this.selectedDate)
		.then((dailies) => {

			if (dailies.length === 0) {
				const noDailyElement = document.createElement("li");

				noDailyElement.innerHTML = `
					<span class="daily-name"> No Dailies</span>
				`;	

				this.DOM["dailyList"].append(noDailyElement);
			}

			if (this.filter)
				dailies = dailies.filter((daily) => !daily.comp);
			if (this.sort)
				dailies.sort(this.sort);

			dailies.forEach( (daily) => {
				// May need to do some filtering as well... DailyBuffer may handle that 
				if ( !this.DOM["dailyList"].querySelector(`#date${daily.did}`) )
					this.DOM["dailyList"].append( this.#getDailyElement(daily) );
			});

		});
	}

	#getDateCellElement(date, dailies) {

		const dateCell = Renderer.dateCellTemplateElement.content.cloneNode(true).children[0];
		dateCell.querySelector(".date-num").innerText = date.getDate();
		dateCell.id = `date${date.getDate()}`;

		const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
		let row = 1 + Math.floor((firstDay.getDay() + date.getDate() - 1)/7);
		let col = date.getDay()+1;
		dateCell.style.gridArea = `${row}/${col}/${row}/${col}`;

		// Count completed dailies and uncompleted
		let compCount = 0;
		let todoCount = 0;
		dailies.forEach((daily) => {
			if (daily.comp)
				compCount++;
			else
				todoCount++;
		});

		dateCell.querySelector("#count-todo").innerText = todoCount > 0 ? todoCount : "";
		dateCell.querySelector("#count-comp").innerText = compCount > 0 ? compCount : "";

		this.dueBuffer.getDuesFromDate(date).then( (dues) => {
			const duedatesElem = dateCell.querySelector(".duedates-container");

			dues.forEach((due) => {
				const icon = Renderer.dueIconTemplateElement.content.cloneNode(true).children[0];
				icon.id = due.ddid;
				icon.title = due.title;
				// FIXME: some icons don't wrok
				icon.classList.add(`fa-${due.icon}`);
				duedatesElem.appendChild(icon);
			});
		});

		// Click functionality
		dateCell.addEventListener("click", (e) => {

			// Correctly set selected class 
			if (dateCell.classList.contains("selected")) {
				return;
			}

			const oldSelectedEl = this.DOM.calendar.querySelector(".selected");
			if (oldSelectedEl) {
				oldSelectedEl.classList.remove('selected');
			}
			dateCell.classList.add("selected");

			// Update daily list
			this.selectedDate.setYear(date.getFullYear());
			this.selectedDate.setMonth(date.getMonth());
			this.selectedDate.setDate(date.getDate());
			this.renderDailyList();
		});

		return dateCell;
	}

	renderCalendar() {

		const calendarElement = this.DOM.dateCellContainer;
		const calendarYM = this.DOM.calYM;

		calendarYM.innerText = getYYYYMMDDFormat(this.selectedDate).slice(0, -3);
		// Reset calendar
		calendarElement.replaceChildren();

		let dateIter = new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth(), 1);

		while (dateIter.getMonth() === this.selectedDate.getMonth()) {

			const date = new Date(dateIter.getFullYear(), dateIter.getMonth(), dateIter.getDate());

			this.dailyBuffer.getDailiesFromDate(date).then((dailies) => {
				const dateCell = this.#getDateCellElement(date, dailies);

				if (sameDay(date, this.selectedDate)) {
					dateCell.classList.add("selected");
				}

				calendarElement.appendChild(dateCell);

			})
			.catch((reason) => {
				// FIXME: Proper error hanlding
				throw reason;
			});


			dateIter.setDate(dateIter.getDate()+1);
		}

		return;
	}


	startClock() {

		if (this.startClock.id)
			throw new Error("Clock is already running");

		const updateClock = () => {
			let curTime = new Date();

			let hour = curTime.getHours();
			let min = curTime.getMinutes();

			this.DOM["clock-time"].innerText = `${(hour%12 === 0) ? 12 : hour%12} : ${(min < 10) ? "0"+min : min} ${(hour < 12) ? "AM" : "PM"}`;
			this.DOM["clock-date"].innerText = getYYYYMMDDFormat(curTime);
		}
		
		updateClock();
		this.startClock.id = setInterval(updateClock, 1000);

		return this.startClock.id;
	}
};


export default Renderer;