/* Yuka 0.7.8 · módulo de objetivos.
 * Fuente: https://github.com/Mugen87/yuka/tree/10591304811222d6856020d5de129b39ef43b58d
 * Clases oficiales concatenadas, sin import/export; resto del código intacto.
 * Archivos: src/core/Logger.js, src/goal/Goal.js, src/goal/CompositeGoal.js, src/goal/GoalEvaluator.js, src/goal/Think.js
 * Licencia MIT; véase yuka-LICENSE.txt. No contiene renderizador ni navegación.
 */
'use strict';
(function(){
/* istanbul ignore next */

/**
* Class with a logger interface. Messages are only logged to console if
* their log level is smaller or equal than the current log level.
*
* @author {@link https://github.com/Mugen87|Mugen87}
*/
class Logger {

	/**
	* Sets the log level for the logger. Allow values are: *LOG*,
	* *WARN*, *ERROR*, *SILENT*. The default level is *WARN*. The constants
	* are accessible over the *Logger.LEVEL* namespace.
	*
	* @param {Number} level - The log level.
	*/
	static setLevel( level ) {

		currentLevel = level;

	}

	/**
	* Logs a message with the level *LOG*.
	*
	* @param {...Any} args - The arguments to log.
	*/
	static log( ...args ) {

		if ( currentLevel <= Logger.LEVEL.LOG ) console.log( ...args );

	}

	/**
	* Logs a message with the level *WARN*.
	*
	* @param {...Any} args - The arguments to log.
	*/
	static warn( ...args ) {

		if ( currentLevel <= Logger.LEVEL.WARN ) console.warn( ...args );

	}

	/**
	* Logs a message with the level *ERROR*.
	*
	* @param {...Any} args - The arguments to log.
	*/
	static error( ...args ) {

		if ( currentLevel <= Logger.LEVEL.ERROR ) console.error( ...args );

	}

}

Logger.LEVEL = Object.freeze( {
	LOG: 0,
	WARN: 1,
	ERROR: 2,
	SILENT: 3
} );

let currentLevel = Logger.LEVEL.WARN;



/**
* Base class for representing a goal in context of Goal-driven agent design.
*
* @author {@link https://github.com/Mugen87|Mugen87}
*/
class Goal {

	/**
	* Constructs a new goal.
	*
	* @param {GameEntity} owner - The owner of this goal.
	*/
	constructor( owner = null ) {

		/**
		* The owner of this goal.
		* @type {?GameEntity}
		* @default null
		*/
		this.owner = owner;

		/**
		* The status of this goal.
		* @type {Status}
		* @default INACTIVE
		*/
		this.status = Goal.STATUS.INACTIVE;

	}

	/**
	* Executed when this goal is activated.
	*/
	activate() {}

	/**
	* Executed in each simulation step.
	*/
	execute() {}

	/**
	* Executed when this goal is satisfied.
	*/
	terminate() {}

	/**
	* Goals can handle messages. Many don't though, so this defines a default behavior
	*
	* @param {Telegram} telegram - The telegram with the message data.
	* @return {Boolean} Whether the message was processed or not.
	*/
	handleMessage( /* telegram */ ) {

		return false;

	}

	/**
	* Returns true if the status of this goal is *ACTIVE*.
	*
	* @return {Boolean} Whether the goal is active or not.
	*/
	active() {

		return this.status === Goal.STATUS.ACTIVE;

	}

	/**
	* Returns true if the status of this goal is *INACTIVE*.
	*
	* @return {Boolean} Whether the goal is inactive or not.
	*/
	inactive() {

		return this.status === Goal.STATUS.INACTIVE;

	}

	/**
	* Returns true if the status of this goal is *COMPLETED*.
	*
	* @return {Boolean} Whether the goal is completed or not.
	*/
	completed() {

		return this.status === Goal.STATUS.COMPLETED;

	}

	/**
	* Returns true if the status of this goal is *FAILED*.
	*
	* @return {Boolean} Whether the goal is failed or not.
	*/
	failed() {

		return this.status === Goal.STATUS.FAILED;

	}

	/**
	* Ensures the goal is replanned if it has failed.
	*
	* @return {Goal} A reference to this goal.
	*/
	replanIfFailed() {

		if ( this.failed() === true ) {

			this.status = Goal.STATUS.INACTIVE;

		}

		return this;

	}

	/**
	* Ensures the goal is activated if it is inactive.
	*
	* @return {Goal} A reference to this goal.
	*/
	activateIfInactive() {

		if ( this.inactive() === true ) {

			this.status = Goal.STATUS.ACTIVE;

			this.activate();

		}

		return this;

	}

	/**
	* Transforms this instance into a JSON object.
	*
	* @return {Object} The JSON object.
	*/
	toJSON() {

		return {
			type: this.constructor.name,
			owner: this.owner.uuid,
			status: this.status
		};

	}

	/**
	* Restores this instance from the given JSON object.
	*
	* @param {Object} json - The JSON object.
	* @return {Goal} A reference to this goal.
	*/
	fromJSON( json ) {

		this.owner = json.owner; // uuid
		this.status = json.status;

		return this;

	}

	/**
	* Restores UUIDs with references to GameEntity objects.
	*
	* @param {Map<String,GameEntity>} entities - Maps game entities to UUIDs.
	* @return {Goal} A reference to this goal.
	*/
	resolveReferences( entities ) {

		this.owner = entities.get( this.owner ) || null;

		return this;

	}

}

Goal.STATUS = Object.freeze( {
	ACTIVE: 'active', // the goal has been activated and will be processed each update step
	INACTIVE: 'inactive', // the goal is waiting to be activated
	COMPLETED: 'completed', // the goal has completed and will be removed on the next update
	FAILED: 'failed' // the goal has failed and will either replan or be removed on the next update
} );




/**
* Class representing a composite goal. Essentially it's a goal which consists of subgoals.
*
* @author {@link https://github.com/Mugen87|Mugen87}
* @augments Goal
*/
class CompositeGoal extends Goal {

	/**
	* Constructs a new composite goal.
	*
	* @param {GameEntity} owner - The owner of this composite goal.
	*/
	constructor( owner = null ) {

		super( owner );

		/**
		* A list of subgoals.
		* @type {Array<Goal>}
		*/
		this.subgoals = new Array();

	}

	/**
	* Adds a goal as a subgoal to this instance.
	*
	* @param {Goal} goal - The subgoal to add.
	* @return {Goal} A reference to this goal.
	*/
	addSubgoal( goal ) {

		this.subgoals.unshift( goal );

		return this;

	}

	/**
	* Removes a subgoal from this instance.
	*
	* @param {Goal} goal - The subgoal to remove.
	* @return {Goal} A reference to this goal.
	*/
	removeSubgoal( goal ) {

		const index = this.subgoals.indexOf( goal );
		this.subgoals.splice( index, 1 );

		return this;

	}

	/**
	* Removes all subgoals and ensures {@link Goal#terminate} is called
	* for each subgoal.
	*
	* @return {Goal} A reference to this goal.
	*/
	clearSubgoals() {

		const subgoals = this.subgoals;

		for ( let i = 0, l = subgoals.length; i < l; i ++ ) {

			const subgoal = subgoals[ i ];

			subgoal.terminate();

		}

		subgoals.length = 0;

		return this;

	}

	/**
	* Returns the current subgoal. If no subgoals are defined, *null* is returned.
	*
	* @return {Goal} The current subgoal.
	*/
	currentSubgoal() {

		const length = this.subgoals.length;

		if ( length > 0 ) {

			return this.subgoals[ length - 1 ];

		} else {

			return null;

		}

	}

	/**
	* Executes the current subgoal of this composite goal.
	*
	* @return {Status} The status of this composite subgoal.
	*/
	executeSubgoals() {

		const subgoals = this.subgoals;

		// remove all completed and failed goals from the back of the subgoal list

		for ( let i = subgoals.length - 1; i >= 0; i -- ) {

			const subgoal = subgoals[ i ];

			if ( ( subgoal.completed() === true ) || ( subgoal.failed() === true ) ) {

				// if the current subgoal is a composite goal, terminate its subgoals too

				if ( subgoal instanceof CompositeGoal ) {

					subgoal.clearSubgoals();

				}

				// terminate the subgoal itself

				subgoal.terminate();
				subgoals.pop();

			} else {

				break;

			}

		}

		// if any subgoals remain, process the one at the back of the list

		const subgoal = this.currentSubgoal();

		if ( subgoal !== null ) {

			subgoal.activateIfInactive();

			subgoal.execute();

			// if subgoal is completed but more subgoals are in the list, return 'ACTIVE'
			// status in order to keep processing the list of subgoals

			if ( ( subgoal.completed() === true ) && ( subgoals.length > 1 ) ) {

				return Goal.STATUS.ACTIVE;

			} else {

				return subgoal.status;

			}

		} else {

			return Goal.STATUS.COMPLETED;

		}

	}

	/**
	* Returns true if this composite goal has subgoals.
	*
	* @return {Boolean} Whether the composite goal has subgoals or not.
	*/
	hasSubgoals() {

		return this.subgoals.length > 0;

	}

	/**
	* Returns true if the given message was processed by the current subgoal.
	*
	* @return {Boolean} Whether the message was processed or not.
	*/
	handleMessage( telegram ) {

		const subgoal = this.currentSubgoal();

		if ( subgoal !== null ) {

			return subgoal.handleMessage( telegram );

		}

		return false;

	}

	/**
	* Transforms this instance into a JSON object.
	*
	* @return {Object} The JSON object.
	*/
	toJSON() {

		const json = super.toJSON();

		json.subgoals = new Array();

		for ( let i = 0, l = this.subgoals.length; i < l; i ++ ) {

			const subgoal = this.subgoals[ i ];
			json.subgoals.push( subgoal.toJSON() );

		}

		return json;

	}

	/**
	* Restores UUIDs with references to GameEntity objects.
	*
	* @param {Map<String,GameEntity>} entities - Maps game entities to UUIDs.
	* @return {CompositeGoal} A reference to this composite goal.
	*/
	resolveReferences( entities ) {

		super.resolveReferences( entities );

		for ( let i = 0, l = this.subgoals.length; i < l; i ++ ) {

			const subgoal = this.subgoals[ i ];
			subgoal.resolveReferences( entities );

		}

		return this;

	}

}



/**
* Base class for representing a goal evaluator in context of Goal-driven agent design.
*
* @author {@link https://github.com/Mugen87|Mugen87}
*/
class GoalEvaluator {

	/**
	* Constructs a new goal evaluator.
	*
	* @param {Number} characterBias - Can be used to adjust the preferences of agents.
	*/
	constructor( characterBias = 1 ) {

		/**
		* Can be used to adjust the preferences of agents. When the desirability score
		* for a goal has been evaluated, it is multiplied by this value.
		* @type {Number}
		* @default 1
		*/
		this.characterBias = characterBias;

	}

	/**
	* Calculates the desirability. It's a score between 0 and 1 representing the desirability
	* of a goal. This goal is considered as a top level strategy of the agent like *Explore* or
	* *AttackTarget*. Must be implemented by all concrete goal evaluators.
	*
	* @param {GameEntity} owner - The owner of this goal evaluator.
	* @return {Number} The desirability.
	*/
	calculateDesirability( /* owner */ ) {

		return 0;

	}

	/**
	* Executed if this goal evaluator produces the highest desirability. Must be implemented
	* by all concrete goal evaluators.
	*
	* @param {GameEntity} owner - The owner of this goal evaluator.
	*/
	setGoal( /* owner */ ) {}

	/**
	* Transforms this instance into a JSON object.
	*
	* @return {Object} The JSON object.
	*/
	toJSON() {

		return {
			type: this.constructor.name,
			characterBias: this.characterBias
		};

	}

	/**
	* Restores this instance from the given JSON object.
	*
	* @param {Object} json - The JSON object.
	* @return {GoalEvaluator} A reference to this goal evaluator.
	*/
	fromJSON( json ) {

		this.characterBias = json.characterBias;

		return this;

	}

}





/**
* Class for representing the brain of a game entity.
*
* @author {@link https://github.com/Mugen87|Mugen87}
* @augments CompositeGoal
*/
class Think extends CompositeGoal {

	/**
	* Constructs a new *Think* object.
	*
	* @param {GameEntity} owner - The owner of this instance.
	*/
	constructor( owner = null ) {

		super( owner );

		/**
		* A list of goal evaluators.
		* @type {Array<GoalEvaluator>}
		*/
		this.evaluators = new Array();

		//

		this._typesMap = new Map();

	}

	/**
	* Executed when this goal is activated.
	*/
	activate() {

		this.arbitrate();

	}

	/**
	* Executed in each simulation step.
	*/
	execute() {

		this.activateIfInactive();

		const subgoalStatus = this.executeSubgoals();

		if ( subgoalStatus === Goal.STATUS.COMPLETED || subgoalStatus === Goal.STATUS.FAILED ) {

			this.status = Goal.STATUS.INACTIVE;

		}

	}

	/**
	* Executed when this goal is satisfied.
	*/
	terminate() {

		this.clearSubgoals();

	}

	/**
	* Adds the given goal evaluator to this instance.
	*
	* @param {GoalEvaluator} evaluator - The goal evaluator to add.
	* @return {Think} A reference to this instance.
	*/
	addEvaluator( evaluator ) {

		this.evaluators.push( evaluator );

		return this;

	}

	/**
	* Removes the given goal evaluator from this instance.
	*
	* @param {GoalEvaluator} evaluator - The goal evaluator to remove.
	* @return {Think} A reference to this instance.
	*/
	removeEvaluator( evaluator ) {

		const index = this.evaluators.indexOf( evaluator );
		this.evaluators.splice( index, 1 );

		return this;

	}

	/**
	* This method represents the top level decision process of an agent.
	* It iterates through each goal evaluator and selects the one that
	* has the highest score as the current goal.
	*
	* @return {Think} A reference to this instance.
	*/
	arbitrate() {

		const evaluators = this.evaluators;

		let bestDesirability = - 1;
		let bestEvaluator = null;

		// try to find the best top-level goal/strategy for the entity

		for ( let i = 0, l = evaluators.length; i < l; i ++ ) {

			const evaluator = evaluators[ i ];

			let desirability = evaluator.calculateDesirability( this.owner );
			desirability *= evaluator.characterBias;

			if ( desirability >= bestDesirability ) {

				bestDesirability = desirability;
				bestEvaluator = evaluator;

			}

		}

		// use the evaluator to set the respective goal

		if ( bestEvaluator !== null ) {

			bestEvaluator.setGoal( this.owner );

		} else {

			Logger.error( 'YUKA.Think: Unable to determine goal evaluator for game entity:', this.owner );

		}

		return this;

	}

	/**
	* Transforms this instance into a JSON object.
	*
	* @return {Object} The JSON object.
	*/
	toJSON() {

		const json = super.toJSON();

		json.evaluators = new Array();

		for ( let i = 0, l = this.evaluators.length; i < l; i ++ ) {

			const evaluator = this.evaluators[ i ];
			json.evaluators.push( evaluator.toJSON() );

		}

		return json;

	}

	/**
	* Restores this instance from the given JSON object.
	*
	* @param {Object} json - The JSON object.
	* @return {Think} A reference to this instance.
	*/
	fromJSON( json ) {

		super.fromJSON( json );

		const typesMap = this._typesMap;

		this.evaluators.length = 0;
		this.terminate();

		// evaluators

		for ( let i = 0, l = json.evaluators.length; i < l; i ++ ) {

			const evaluatorJSON = json.evaluators[ i ];
			const type = evaluatorJSON.type;

			const ctor = typesMap.get( type );

			if ( ctor !== undefined ) {

				const evaluator = new ctor().fromJSON( evaluatorJSON );
				this.evaluators.push( evaluator );

			} else {

				Logger.warn( 'YUKA.Think: Unsupported goal evaluator type:', type );
				continue;

			}

		}

		// goals

		function parseGoal( goalJSON ) {

			const type = goalJSON.type;

			const ctor = typesMap.get( type );

			if ( ctor !== undefined ) {

				const goal = new ctor().fromJSON( goalJSON );

				const subgoalsJSON = goalJSON.subgoals;

				if ( subgoalsJSON !== undefined ) {

					// composite goal

					for ( let i = 0, l = subgoalsJSON.length; i < l; i ++ ) {

						const subgoal = parseGoal( subgoalsJSON[ i ] );

						if ( subgoal ) goal.subgoals.push( subgoal );

					}

				}

				return goal;

			} else {

				Logger.warn( 'YUKA.Think: Unsupported goal evaluator type:', type );
				return;

			}

		}

		for ( let i = 0, l = json.subgoals.length; i < l; i ++ ) {

			const subgoal = parseGoal( json.subgoals[ i ] );

			if ( subgoal ) this.subgoals.push( subgoal );

		}

		return this;

	}

	/**
	* Registers a custom type for deserialization. When calling {@link Think#fromJSON}
	* this instance is able to pick the correct constructor in order to create custom
	* goals or goal evaluators.
	*
	* @param {String} type - The name of the goal or goal evaluator.
	* @param {Function} constructor - The constructor function.
	* @return {Think} A reference to this instance.
	*/
	registerType( type, constructor ) {

		this._typesMap.set( type, constructor );

		return this;

	}

}



window.CAOZ_YUKA=Object.freeze({Goal,CompositeGoal,GoalEvaluator,Think});
})();

