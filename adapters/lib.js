const BN = require('bn.js')
const assert = require('assert')

async function isChannelValid(cfg, channel, address) {
	const addrEq = (a, b) => a.toLowerCase() === b.toLowerCase()
	const ourValidator = channel.spec.validators.find(({ id }) => addrEq(address, id))
	assert.ok(ourValidator, 'channel is not validated by us')

	assert.ok(channel.validUntil * 1000 > Date.now(), 'channel.validUntil has passed')

	if (cfg.VALIDATORS_WHITELIST && cfg.VALIDATORS_WHITELIST.length) {
		assert.ok(
			channel.spec.validators.every(
				({ id }) => addrEq(id, address) || cfg.VALIDATORS_WHITELIST.includes(id.toLowerCase())
			),
			'validators are not in the whitelist'
		)
	}
	if (cfg.CREATORS_WHITELIST && cfg.CREATORS_WHITELIST.length) {
		assert.ok(
			cfg.CREATORS_WHITELIST.includes(channel.creator.toLowerCase()),
			'channel.creator is not whitelisted'
		)
	}
	if (cfg.TOKEN_ADDRESS_WHITELIST && cfg.TOKEN_ADDRESS_WHITELIST.length) {
		const depositAsset = channel.depositAsset

		assert.ok(
			cfg.TOKEN_ADDRESS_WHITELIST.every(
				id =>
					addrEq(id, depositAsset) ||
					cfg.TOKEN_ADDRESS_WHITELIST.includes(depositAsset.toLowerCase())
			),
			'channel.depositAsset is not whitelisted'
		)
	}
	assert.ok(
		new BN(channel.depositAmount).gte(new BN(cfg.MINIMAL_DEPOSIT || 0)),
		'channel.depositAmount is less than MINIMAL_DEPOSIT'
	)
	assert.ok(
		new BN(ourValidator.fee).gte(new BN(cfg.MINIMAL_FEE || 0)),
		'channel validator fee is less than MINIMAL_FEE'
	)
	assert.ok(
		channel.spec.withdrawPeriodStart < channel.validUntil * 1000,
		'channel withdrawPeriodStart is invalid'
	)
}

module.exports = {
	isChannelValid
}
