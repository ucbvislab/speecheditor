(function() {

    var _subjects = [];
    var _observables = [];


    function ObservableArray(subject) {
        var _old_subject = [];
        var _handlers = {
            generic: [],
            create: [],
            update: [],
            'delete': []
        };

        function reset() {
            callGenericSubscribers();
            _old_subject = JSON.parse(JSON.stringify(subject));
        }


        function callGenericSubscribers() {
            _.each(_handlers.generic, function(f) {
                f(subject, _old_subject);
            });
        }


        function callCreateSubscribers(new_item, item_index) {
            _.each(_handlers.create, function(f) {
                f(new_item, item_index);
            });
        }


        function callUpdateSubscribers(new_item, old_item, item_index) {
            _.each(_handlers.update, function(f) {
                f(new_item, old_item, item_index);
            });
        }


        function callDeleteSubscribers(deleted_item, item_index) {
            _.each(_handlers['delete'], function(f) {
                f(deleted_item, item_index);
            });
        }


        function detectChanges() {
            var old_length = _old_subject.length;
            var new_length = subject.length;

            if (old_length != new_length || JSON.stringify(_old_subject) != JSON.stringify(subject)) {
                var max = Math.max(new_length, old_length) - 1;

                for (var i = max; i >= 0; i--) {
                    var old_item = _old_subject[i];
                    var new_item = subject[i];
                    if (i > old_length - 1) {
                        callCreateSubscribers(new_item, i);
                    } else if (i > new_length - 1) {
                        callDeleteSubscribers(old_item, i);
                    } else if (!_.isEqual(new_item, old_item)) {
                        callUpdateSubscribers(new_item, old_item, i);
                    }
                }

                reset();
            }
        }


        /* ################################################################
           Array mutator methods
        ################################################################ */

        // We need to augment all the standard Array mutator methods to notify
        // all observers in case of a change.
        //
        // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array#Mutator_methods

        // pop: Removes the last element from an array and returns that element.
        subject.pop = function() {
            detectChanges();
            var deleted_item = Array.prototype.pop.apply(this, arguments);
            var item_index = this.length;
            callDeleteSubscribers(deleted_item, item_index);
            reset();
            return deleted_item;
        };


        // push: Adds one or more elements to the end of an array and returns 
        // the new length of the array.
        subject.push = function() {
            detectChanges();
            var new_item = arguments[0];
            var new_length = Array.prototype.push.apply(this, arguments);
            callCreateSubscribers(new_item, new_length - 1);
            reset();
            return new_length;
        };


        // reverse: Reverses the order of the elements of an array -- the first
        // becomes the last, and the last becomes the first.
        subject.reverse = function() {
            detectChanges();
            // Always use reverse loops when deleting stuff based on index
            for (var j = this.length - 1; j >= 0; j--) {
                callDeleteSubscribers(this[j], j);
            }
            var result = Array.prototype.reverse.apply(this, arguments);
            _.each(this, callCreateSubscribers);
            reset();
            return result;
        };


        // shift: Removes the first element from an array and returns that 
        // element.
        subject.shift = function() {
            detectChanges();
            var deleted_item = Array.prototype.shift.apply(this, arguments);
            callDeleteSubscribers(deleted_item, 0);
            reset();
            return deleted_item;
        };


        // sort: Sorts the elements of an array.
        subject.sort = function() {
            detectChanges();
            // Always use reverse loops when deleting stuff based on index
            for (var j = this.length - 1; j >= 0; j--) {
                callDeleteSubscribers(this[j], j);
            }
            var result = Array.prototype.sort.apply(this, arguments);
            _.each(this, callCreateSubscribers);
            reset();
            return result;
        };


        // splice: Adds and/or removes elements from an array.
        subject.splice = function(i, length /*, insert */) {
            detectChanges();
            var insert = Array.prototype.slice.call(arguments, 2);
            var deleted = Array.prototype.splice.apply(this, arguments);
            // Always use reverse loops when deleting stuff based on index
            for (var j = deleted.length - 1; j >= 0; j--) {
                callDeleteSubscribers(deleted[j], i + j);
            }
            _.each(insert, function(new_item, k) {
                callCreateSubscribers(new_item, i + k);
            });
            reset();
            return deleted;
        };


        // unshift: Adds one or more elements to the front of an array and
        // returns the new length of the array.
        subject.unshift = function() {
            detectChanges();
            var new_item = arguments[0];
            var new_length = Array.prototype.unshift.apply(this, arguments);
            callCreateSubscribers(new_item, 0);
            reset();
            return new_length;
        };


        setInterval(detectChanges, 250);


        return {
            unbind: function(type, handler) {
                // TODO
            },
            bind: function(type, handler) {
                _handlers[type].push(handler);
                if (type == 'generic') {
                    handler(subject, _old_subject);
                } else if (type == 'create') {
                    _.each(subject, handler);
                }
                _old_subject = JSON.parse(JSON.stringify(subject));
            }
        };

    }


    _.mixin({
        observe: function(subject, type, f) {
            if (!_.isArray(subject)) {
                throw "subject should be a array";
            }

            if (_.isFunction(type)) {
                f = type;
                type = 'generic';
            }

            var index = _.indexOf(_subjects, subject);
            if (index == -1) {
                index = _subjects.length;
                _subjects.push(subject);
                var observable = new ObservableArray(subject);
                _observables.push(observable);
            }
            _observables[index].bind(type, f);
            return subject;
        },


        unobserve: function(subject, type, f) {
            // TODO
            // behavior:
            //  - no arguments: remove all observables
            //  - only a subject: remove all observers for subject
            //  - subject + f: remove generic subsciber f for subject
            //  - subject + type: remove type subscriber for subject
            //  - subject + type + f: remove type subscriber f for subject
            return subject;
        }
    });


    // Little jQuery utility function to insert an element at a certain index
    if (typeof jQuery != 'undefined' && typeof jQuery.fn.insertAt == 'undefined') {
        jQuery.fn.insertAt = function insertAt(index, element) {
            if (index === 0) {
                this.prepend(element);
            } else if (index < this.length - 1) {
                $(this[index]).before(element);
            } else {
                this.append(element);
            }
            return this;
        };
    }

})();