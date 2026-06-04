#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
pub enum DataKey {
    Balance(Address),
}

#[contract]
pub struct OrbiPoints;

#[contractimpl]
impl OrbiPoints {
    /// Mint `amount` points to `to`. Requires authorization from `to`.
    pub fn mint(env: Env, to: Address, amount: i128) {
        to.require_auth();
        let current: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to), &(current + amount));
    }

    /// Read the points balance of `addr`.
    pub fn balance(env: Env, addr: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(addr))
            .unwrap_or(0)
    }
}
