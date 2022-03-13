console.log("CA")

class Test {
	a = 1;
	#b = 2;
	static #c = 3;

	constructor() {

	}

	bark() {
		return Test.#c
	}
}


let test = new Test();
console.log(test.bark());
console.log("WLDJA")