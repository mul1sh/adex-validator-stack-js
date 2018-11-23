const assert = require('assert')
const BN = require('bn.js')
const db = require('../../db')

const MAX_PER_TICK = 100

function tick(channel) {
	const eventAggrCol = db.getMongo().collection('eventAggregates')
	const stateTreeCol = db.getMongo().collection('channelStateTrees')

	// @TODO obtain channel payment info
	// @TODO leader/follower: update channel lastUpdated

	return stateTreeCol.findOne({ _id: channel._id })
	.then(function(stateTree) {
		return stateTree || { balances: {}, lastEvAggr: new Date(0) }
	})
	.then(function(stateTree) {
		return eventAggrCol.find({
			channelId: channel._id,
			created: { $gt: stateTree.lastEvAggr }
		})
		// @TODO restore this limit, but it requires sorting by created from old to new
		// otherwise, created: { $gt: xxx } would break
		//.limit(MAX_PER_TICK)
		.toArray()
		.then(function(aggrs) {
			logMerge(channel, aggrs)

			if (!aggrs.length) {
				return { updated: false, channel }
			}

			const newStateTree = mergeAggrs(stateTree, aggrs, { amount: 1 })

			return stateTreeCol
			.updateOne(
				{ _id: channel._id },
				{ $set: newStateTree },
				{ upsert: true }
			)
			.then(function() {
				return { updated: true, channel, newStateTree }
			})
		})
	})
}

// Pure, should not mutate inputs
function mergeAggrs(stateTree, aggrs, paymentInfo) {
	const newStateTree = { balances: {}, lastEvAggr: stateTree.lastEvAggr }

	// Build an intermediary balances representation
	const balances = {}
	Object.keys(stateTree.balances).forEach(function(acc) {
		balances[acc] = new BN(stateTree.balances[acc], 10)
		assert.ok(!balances[acc].isNeg())
	})

	// Merge in all the aggrs
	aggrs.forEach(function(evAggr) {
		newStateTree.lastEvAggr = new Date(Math.max(
			newStateTree.lastEvAggr.getTime(),
			evAggr.created.getTime()
		))

		// @TODO do something about this hardcoded event type assumption
		mergePayableIntoBalances(balances, evAggr.events.IMPRESSION, paymentInfo)
	})

	// Rewrite into the newStateTree
	Object.keys(balances).forEach(function(acc) {
		newStateTree.balances[acc] = balances[acc].toString(10)
	})

	return newStateTree
}

// Mutates the balances input
function mergePayableIntoBalances(balances, events, paymentInfo) {
	if (!events) return
	Object.keys(events).forEach(function(acc) {
		if (!balances[acc]) balances[acc] = new BN(0, 10)
		// @TODO: this is an easy place where we can limit the impression count
		// it makes sense too, as it's a natural throttle of 1 per evAggr era
		// unless acc == publisher, in which case it does not make sense
		balances[acc] = balances[acc].add(new BN(events[acc] * paymentInfo.amount))
	})
}

function logMerge(channel, eventAggrs) {
	// @TODO optional
	console.log(`Channel ${channel._id}: processing ${eventAggrs.length} event aggregates`)
}

module.exports = { tick }
