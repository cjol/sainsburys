import { Chromeless } from "chromeless";
import * as moment from "moment";
import * as fs from "fs";

type Item = {
	description: string;
	price: number;
	quantity: {
		unit: string;
		number: number;
	};
};
type Order = {
	number: string;
	date: Date;
	dateString?: string;
	price: number;
	link: string;
	items: Promise<Item[]>;
};

async function run(lastNItems: number) {
	const linkFetcher = new Chromeless({
		waitTimeout: 20000, // in ms
		implicitWait: true,
		scrollBeforeClick: true,
	})
		.goto("http://www.sainsburys.co.uk/shop/gb/groceries")
		.click(".loginRegister a")
		.type("tjlefeuvre@gmail.com", 'input[name="logonId"]')
		.type("NoSpacesIn", 'input[name="logonPassword"]')
		.press(13)
		.click("input.button.process")
		.wait(".myAccountAreasWrapper")
		.evaluate<void>(() => {
			// this will be executed in headless chrome
			const myLink = [
				...document.querySelectorAll(".areaCard a"),
			].find(x => {
				if (x && x.textContent) {
					return x.textContent.match(/My orders/) !== null;
				}
				return false;
			});

			if (myLink) myLink.click();
		})
		.wait(".orderListPanel")
		.evaluate<Order[]>(() =>
			[
				...document.querySelectorAll(".ordersListItem"),
			].map((li: Element) => {
				const numberSpan = li.querySelector(".orderNumber .number");
				const totalSpan = li.querySelector(".orderTotal");
				const timeSpan = [
					...li.querySelectorAll(".orderDelivery p"),
				].find(
					x =>
						x.textContent !== null &&
						x.textContent.match(/Delivery date:/) !== null
				);
				const orderLink = li.querySelector(".orderActions a");
				const order: Partial<Order> = {};

				if (numberSpan && numberSpan.textContent)
					order.number = numberSpan.textContent;
				if (timeSpan && timeSpan.textContent) {
					const m = timeSpan.textContent.match(
						/Delivery date: ([^,]*)/
					);
					if (m) order.dateString = m[1];
				}
				if (totalSpan && totalSpan.textContent) {
					const m = totalSpan.textContent.match(/£(\d+(?:.\d\d))?/);
					if (m) order.price = parseFloat(m[1]);
				}
				if (orderLink) {
					const href = orderLink.getAttribute("href");
					if (href) order.link = href;
				}

				return order;
			})
		);

	const alreadyGrabbed = fs.readdirSync(`out`);

	const orderLinks = (await linkFetcher)
		.map(l => {
			l.date = moment(l.dateString, "dddd DD MMMM YYYY").toDate();
			console.log(l.dateString, l.date);
			return l;
		})
		.filter(l => {
			return (
				alreadyGrabbed.indexOf(
					l.date.toISOString().substr(0, 10) + ".tsv"
				) < 0
			);
		});

	for (const order of orderLinks) {
		const page = new Chromeless({
			waitTimeout: 20000, // in ms
			implicitWait: true,
			scrollBeforeClick: true,
		}).goto(order.link);

		const itemFetcher = page
			.wait(".trolleySummaryItem")
			.evaluate<Item[]>(() =>
				[
					...document.querySelectorAll(".trolleySummaryItem"),
				].map(li => {
					const item: Partial<Item> = {};

					const descriptionSpan = li.querySelector(
						".productDescription"
					);
					if (descriptionSpan && descriptionSpan.textContent)
						item.description = descriptionSpan.textContent.trim();

					const priceSpan = li.querySelector(
						".productDetails .cost strong"
					);
					if (priceSpan && priceSpan.textContent) {
						const match = priceSpan.textContent.match(
							/£(\d+.\d\d)/
						);
						if (match) item.price = parseFloat(match[1]);
					}

					const detailsSpan = [
						...li.querySelectorAll(".productDetails p"),
					].find(
						p =>
							p.textContent !== null &&
							p.textContent.match("Quantity:") !== null
					);
					if (detailsSpan && detailsSpan.textContent) {
						const match = detailsSpan.textContent.match(
							/Quantity:\s+(\d+(?:\.\d+)?)(kg|g)?/
						);
						if (match)
							item.quantity = {
								unit: match[2] || "units",
								number: parseFloat(match[1]),
							};
					}

					return item;
				})
			);
		order.items = itemFetcher;
		order.items.then(() => {
			itemFetcher.end();
			console.log("Ended item fetcher");
		});
		await page;
	}

	Promise.all(
		orderLinks.filter(o => o.items !== undefined).map(o => o.items)
	).then(() => linkFetcher.end());
	console.log("Ended link fetcher");

	orderLinks.forEach(order => {
		if (order.items === undefined) return;
		order.items.then(items => {
			console.log(
				`\nORDER NUMBER ${order.number} (${order.date.toLocaleDateString(
					"en-GB"
				)})`
			);
			const output = items
				.map(
					item =>
						`${item.description}\t${item.price}\t${item.quantity
							? item.quantity.number
							: "UNKNOWN"}`
				)
				.join("\n");

			fs.writeFile(
				`out/${order.date.toISOString().substr(0, 10)}.tsv`,
				output,
				err => (err ? console.error(err) : console.log("Done 1"))
			);
		});
	});
}

run(5).catch(console.error.bind(console));
