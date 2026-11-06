"""Generate a labelled synthetic transaction CSV in the IBM AML column layout."""
import argparse
import csv
import math
import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from itertools import cycle
from pathlib import Path

START = datetime(2026, 9, 1)
PERIOD_DAYS = 14
BANKS = ["001", "012", "027", "034", "048", "055", "063", "070"]
FORMATS = ["ACH", "Wire", "Credit Card", "Cheque"]
FORMAT_WEIGHTS = [50, 25, 20, 5]
CURRENCIES = ["USD", "EUR"]
CURRENCY_WEIGHTS = [85, 15]
HOUR_WEIGHTS = [1, 1, 1, 1, 1, 2, 3, 6, 10, 12, 12, 11, 10, 11, 12, 12, 10, 8, 6, 5, 4, 3, 2, 1]
COLUMNS = [
    "Timestamp", "From Bank", "Account", "To Bank", "Account.1",
    "Amount Received", "Receiving Currency", "Amount Paid", "Payment Currency",
    "Payment Format", "Is Laundering", "Scenario", "Case ID",
]


@dataclass
class Transfer:
    timestamp: datetime
    sender: tuple[str, str]
    receiver: tuple[str, str]
    amount: float
    currency: str
    label: int
    scenario: str
    case_id: str
    payment_format: str


class Generator:
    def __init__(self, seed: int):
        self.rng = random.Random(seed)
        self.used_accounts: set[tuple[str, str]] = set()
        self.case_number = 0

    def account(self) -> tuple[str, str]:
        while True:
            account = (self.rng.choice(BANKS), f"{self.rng.getrandbits(36):09X}")
            if account not in self.used_accounts:
                self.used_accounts.add(account)
                return account

    def accounts(self, count: int) -> list[tuple[str, str]]:
        return [self.account() for _ in range(count)]

    def payment_format(self) -> str:
        return self.rng.choices(FORMATS, FORMAT_WEIGHTS)[0]

    def currency(self) -> str:
        return self.rng.choices(CURRENCIES, CURRENCY_WEIGHTS)[0]

    def amount(self, low: float, high: float) -> float:
        return round(self.rng.uniform(low, high), 2)

    def business_time(self) -> datetime:
        day = self.rng.randrange(PERIOD_DAYS)
        hour = self.rng.choices(range(24), HOUR_WEIGHTS)[0]
        return START + timedelta(days=day, hours=hour, seconds=self.rng.randrange(3600))

    def case_start(self) -> datetime:
        latest = (PERIOD_DAYS - 2) * 86_400
        return START + timedelta(seconds=self.rng.randrange(latest))

    def next_case(self, prefix: str) -> str:
        self.case_number += 1
        return f"{prefix}-{self.case_number:05d}"

    def transfer(self, moment, sender, receiver, amount, currency, label, scenario, case_id):
        return Transfer(
            moment, sender, receiver, amount, currency, label, scenario, case_id,
            self.payment_format(),
        )

    def normal(self, count: int) -> list[Transfer]:
        pool = self.accounts(max(200, count // 5))
        home = {account: self.currency() for account in pool}
        by_currency = {
            currency: [account for account in pool if home[account] == currency]
            for currency in CURRENCIES
        }
        rows = []
        for _ in range(count):
            currency = self.currency()
            sender, receiver = self.rng.sample(by_currency[currency], 2)
            amount = round(min(self.rng.lognormvariate(math.log(350), 1.3), 250_000), 2)
            rows.append(
                self.transfer(
                    self.business_time(), sender, receiver, max(amount, 5.0),
                    currency, 0, "normal", "",
                )
            )
        return rows

    def high_value(self) -> list[Transfer]:
        case = self.next_case("HV")
        sender, receiver = self.accounts(2)
        amount = self.amount(12_000, 90_000)
        return [self.transfer(self.case_start(), sender, receiver, amount, self.currency(), 1, "high_value", case)]

    def high_velocity(self) -> list[Transfer]:
        case = self.next_case("VEL")
        sender = self.account()
        receivers = self.accounts(3)
        currency = self.currency()
        moment = self.case_start()
        rows = []
        for _ in range(self.rng.randint(6, 8)):
            rows.append(
                self.transfer(
                    moment, sender, self.rng.choice(receivers), self.amount(200, 2_000),
                    currency, 1, "high_velocity", case,
                )
            )
            moment += timedelta(seconds=self.rng.randint(180, 480))
        return rows

    def structuring(self) -> list[Transfer]:
        return self.structured_series("STR", "structuring", (300, 1_200))

    def slow_structuring(self) -> list[Transfer]:
        return self.structured_series("SSTR", "slow_structuring", (7_200, 18_000))

    def structured_series(self, prefix, scenario, gap_seconds) -> list[Transfer]:
        case = self.next_case(prefix)
        sender = self.account()
        receiver = self.account()
        currency = self.currency()
        moment = self.case_start()
        rows = []
        for _ in range(self.rng.randint(3, 5)):
            rows.append(
                self.transfer(
                    moment, sender, receiver, self.amount(8_100, 9_950),
                    currency, 1, scenario, case,
                )
            )
            moment += timedelta(seconds=self.rng.randint(*gap_seconds))
        return rows

    def fan_in(self) -> list[Transfer]:
        return self.collect("FIN", "fan_in", 1, (120, 480), (500, 3_000))

    def slow_fan_in(self) -> list[Transfer]:
        return self.collect("SFIN", "slow_fan_in", 1, (3_600, 9_000), (500, 3_000))

    def merchant_settlement(self) -> list[Transfer]:
        return self.collect("LMER", "merchant_settlement", 0, (120, 420), (40, 400))

    def collect(self, prefix, scenario, label, gap_seconds, amounts) -> list[Transfer]:
        case = self.next_case(prefix)
        hub = self.account()
        currency = self.currency()
        moment = self.case_start()
        rows = []
        for sender in self.accounts(self.rng.randint(4, 7)):
            rows.append(
                self.transfer(moment, sender, hub, self.amount(*amounts), currency, label, scenario, case)
            )
            moment += timedelta(seconds=self.rng.randint(*gap_seconds))
        return rows

    def fan_out(self) -> list[Transfer]:
        return self.distribute("FOUT", "fan_out", 1, (120, 480), (500, 3_000))

    def payroll(self) -> list[Transfer]:
        return self.distribute("LPAY", "payroll", 0, (5, 60), (1_500, 4_000))

    def distribute(self, prefix, scenario, label, gap_seconds, amounts) -> list[Transfer]:
        case = self.next_case(prefix)
        hub = self.account()
        currency = self.currency()
        moment = self.case_start()
        rows = []
        for receiver in self.accounts(self.rng.randint(4, 7)):
            rows.append(
                self.transfer(moment, hub, receiver, self.amount(*amounts), currency, label, scenario, case)
            )
            moment += timedelta(seconds=self.rng.randint(*gap_seconds))
        return rows

    def rapid_chain(self) -> list[Transfer]:
        return self.chain("RAP", "rapid_movement", 1, (180, 540))

    def slow_chain(self) -> list[Transfer]:
        return self.chain("SRAP", "slow_layering", 1, (1_800, 5_400))

    def treasury_sweep(self) -> list[Transfer]:
        return self.chain("LTRS", "treasury_sweep", 0, (120, 420))

    def chain(self, prefix, scenario, label, gap_seconds) -> list[Transfer]:
        case = self.next_case(prefix)
        hops = self.accounts(self.rng.randint(3, 5))
        currency = self.currency()
        moment = self.case_start()
        amount = self.amount(2_000, 7_500)
        rows = []
        for sender, receiver in zip(hops, hops[1:]):
            rows.append(self.transfer(moment, sender, receiver, amount, currency, label, scenario, case))
            moment += timedelta(seconds=self.rng.randint(*gap_seconds))
            amount = round(amount * self.rng.uniform(0.93, 0.99), 2)
        return rows

    def just_below_band(self) -> list[Transfer]:
        case = self.next_case("BLOW")
        sender = self.account()
        receiver = self.account()
        currency = self.currency()
        moment = self.case_start()
        rows = []
        for _ in range(self.rng.randint(3, 5)):
            rows.append(
                self.transfer(
                    moment, sender, receiver, self.amount(7_200, 7_950),
                    currency, 1, "just_below_band", case,
                )
            )
            moment += timedelta(seconds=self.rng.randint(300, 1_200))
        return rows

    def large_invoice(self) -> list[Transfer]:
        case = self.next_case("LINV")
        sender, receiver = self.accounts(2)
        amount = self.amount(11_000, 60_000)
        return [self.transfer(self.case_start(), sender, receiver, amount, self.currency(), 0, "large_invoice", case)]

    def planted(self, builders, target: int) -> list[Transfer]:
        rows: list[Transfer] = []
        for build in cycle(builders):
            if len(rows) >= target:
                return rows
            rows += build()
        return rows

    def dataset(self, rows: int, suspicious_rate: float) -> list[Transfer]:
        suspicious = self.planted(
            [
                self.high_value, self.high_velocity, self.structuring, self.fan_in,
                self.fan_out, self.rapid_chain, self.slow_structuring,
                self.high_value, self.high_velocity, self.structuring, self.fan_in,
                self.fan_out, self.rapid_chain, self.slow_fan_in,
                self.high_value, self.high_velocity, self.structuring, self.fan_in,
                self.fan_out, self.rapid_chain, self.slow_chain,
                self.high_value, self.high_velocity, self.structuring, self.fan_in,
                self.fan_out, self.rapid_chain, self.just_below_band,
            ],
            round(rows * suspicious_rate),
        )
        lookalikes = self.planted(
            [self.payroll, self.merchant_settlement, self.large_invoice, self.treasury_sweep],
            round(rows * suspicious_rate / 2),
        )
        remaining = rows - len(suspicious) - len(lookalikes)
        if remaining < 0:
            raise ValueError("rows is too small for the requested suspicious rate")
        return sorted(
            suspicious + lookalikes + self.normal(remaining),
            key=lambda item: (item.timestamp, item.sender, item.receiver),
        )


def write_csv(path: Path, transfers: list[Transfer]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(COLUMNS)
        for item in transfers:
            writer.writerow([
                item.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                item.sender[0], item.sender[1], item.receiver[0], item.receiver[1],
                f"{item.amount:.2f}", item.currency, f"{item.amount:.2f}", item.currency,
                item.payment_format, item.label, item.scenario, item.case_id,
            ])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rows", type=int, default=3000)
    parser.add_argument("--seed", type=int, default=19)
    parser.add_argument("--suspicious-rate", type=float, default=0.02)
    parser.add_argument(
        "--output", type=Path,
        default=Path(__file__).resolve().parent.parent / "data" / "sample" / "transactions.csv",
    )
    args = parser.parse_args()
    if not 100 <= args.rows <= 100_000:
        parser.error("--rows must be between 100 and 100000")
    if not 0 < args.suspicious_rate <= 0.2:
        parser.error("--suspicious-rate must be above 0 and at most 0.2")

    transfers = Generator(args.seed).dataset(args.rows, args.suspicious_rate)
    write_csv(args.output, transfers)
    suspicious = sum(item.label for item in transfers)
    cases = len({item.case_id for item in transfers if item.label})
    print(f"{args.output}: {len(transfers)} rows, {suspicious} suspicious rows, {cases} suspicious cases")


if __name__ == "__main__":
    main()
