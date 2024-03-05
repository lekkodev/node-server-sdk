/* Welcome to Lekko's Native Language Interface
 *
 * Please abide by our simple rules, or we will delete your code in prod
 * Rule 1:  Keep your code simple.  No loops, nothing outside this file.
 * Rule 2:  Keep your objects simmple.  No functions on them.
 */


// Enums are great, we support those
/*
enum Environment {
	Development = "Development",
	Staging = "Staging",
	Testing = "Testing",
	Production = "Production",
};
*/
export interface Dog {
	name: string;
	gender: string;
	owner?: string;
	healthRecord: {
		vaccinations: {
			type: string;
		}[];
	};
}


export async function getPuppyFlag({isCool, breed}: {isCool: string, breed: string}):  Promise<boolean> {
	if (isCool === "foo") {
		return true;
	}
	if (isCool === "bar" && breed === "lab") {
		return true;
	}
	if ((isCool === "bar") && (breed === "retriever")) {
		return true;
	}
	return false;
}

export async function getPuppyFartRisk({isCool, breed}: {isCool: string, breed: string}):  Promise<string> {
	if (isCool === "foo") {
		return "Deadly";
	}
	if (isCool === "bar" && breed === "lab") {
		return "Serious";
	}
	if ((isCool === "bar") && (breed === "retriever")) {
		return "Deadly";
	}
	return "Use Caution";
}

export async function getPuppyNumber({isCool, breed}: {isCool: string, breed: string}):  Promise<number> {
	if (isCool === "foo") {
		return 6;
	}
	return 9;
}

export async function getGuardDog(): Promise<Dog> {
	return {
    name: "Rex",
    gender: "male",
    healthRecord: {
      vaccinations: []
    },
  };
}