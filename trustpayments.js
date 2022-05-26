(function () {
    // Polyfill for creating CustomEvents on IE9/10/11

    // code pulled from:
    // https://github.com/d4tocchini/customevent-polyfill
    // https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent#Polyfill

    if (typeof window === 'undefined') {
        return;
    }

    try {
        var ce = new window.CustomEvent('test', { cancelable: true });
        ce.preventDefault();
        if (ce.defaultPrevented !== true) {
            // IE has problems with .preventDefault() on custom events
            // http://stackoverflow.com/questions/23349191
            throw new Error('Could not prevent default');
        }
    } catch (e) {
        var CustomEvent = function (event, params) {
            var evt, origPrevent;
            params = params || {
                bubbles: false,
                cancelable: false,
                detail: undefined
            };

            evt = document.createEvent("CustomEvent");
            evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
            origPrevent = evt.preventDefault;
            evt.preventDefault = function () {
                origPrevent.call(this);
                try {
                    Object.defineProperty(this, 'defaultPrevented', {
                        get: function () {
                            return true;
                        }
                    });
                } catch (e) {
                    this.defaultPrevented = true;
                }
            };
            return evt;
        };

        CustomEvent.prototype = window.Event.prototype;
        window.CustomEvent = CustomEvent; // expose definition to window
    }
})();

(function () {

    /*
     *  
     */
    const TradeItTrustPayments = function () {

        const snakeToCamel = str =>
            str.toLowerCase().replace(/([-_][a-z])/g, group =>
                group
                    .toUpperCase()
                    .replace('-', '')
                    .replace('_', '')
            );

        const tpInstances = {};
        const initialised = false;
        const stConfigDataAttribute = "st-config";

        /*
         *  Register a new Trust Payments Js configuration.
         *  
         *  Possible keys are currrently newcard and savedcard
         */
        var addTpInstance = function (key, settings) {

            if (!settings || !settings.Jwt) {
                console.error("No JWT value specified;")
            }

            //Mechanism for showing on the first or active user interface
            tpInstances[key] = settings;

        }

        /*
         * Should be called once per page and initialises the payment interface based on which payment methods have been registered.
         */
        var initTpInstances = function () {

            if (!initialised) {

                initialised = true;


                /*
                 * This is to maintain backward compatability where we use saved-card st.js with payment pages new-card.
                 * 
                 * There are now 3 options for running st.js
                 * 
                 * - st.js saved-card with payment-pages new card
                 * - st.js new-card only
                 * - st.js new-card with st.js saved-card inline
                 * 
                 * However in tradeit new-card and saved-card are represented as two payment methods and its really
                 * the combination of which of those payment methods are registered that determined which of the trust
                 * payment options we use.
                 */
                if (tpInstances.newcard && tpInstances.savedcard) {
                    //This is new-card with saved card inline
                    let settings = tpInstances.newcard;

                    //inline the tokenized config so that we can detect that we are using inline-saved cards
                    settings.tokenizedConfig = tpInstances.savedcard;

                    initWithSettings(settings);
                } else if (tpInstances.savedcard) {
                    //This is saved-card only
                    initWithSettings(tpInstances.savedcard);
                } else if (tpInstances.newcard) {
                    //This is new-card only
                    initWithSettings(tpInstances.newcard);
                }

            }
        }

        /*
         * Get a unique form id
         */
        var getFormId = function (containerID) {

            var $form = $('#' + containerID + ' form');

            var formid = $form.attr('id');

            if (!formid || formid.length === 0) {
                {
                    formid = `${containerID}_form`;
                    $form.attr('id', formid);
                }
            }

            return formid;

        };

        /*
         * Initialise the interface using the configuration provided.
         */
        var initWithSettings = function (config) {

            if (!config || !config.Jwt) {
                console.error("No JWT value specified;")
            }

            /*
             * Get a unique button id.
             */
            var getButtonId = function (containerID, btnName, btnValue) {

                var $btn = $('[type=submit][name="' + btnName + '"][value="' + btnValue + '"]');

                var btnid = $btn.attr('id');

                if (!btnid || btnid.length === 0) {
                    {
                        btnid = `${containerID}_paynowbtn`;
                        $btn.attr('id', btnid);
                    }
                }

                return btnid;

            };

            /*
             * Styles are provided in the payment component using a method named getTrustPaymentJsLibStyles.
             */
            var getStyles = function () {

                if (typeof getTrustPaymentJsLibStyles !== 'undefined' && jQuery.isFunction(getTrustPaymentJsLibStyles)) {
                    return getTrustPaymentJsLibStyles();
                }

                return {};

            };

            /*
             * Translations are provided in the payment component using a method named getTrustPaymentJsLibTranslations.
             */
            var getTranslations = function () {

                if (typeof getTrustPaymentJsLibTranslations !== 'undefined' && jQuery.isFunction(getTrustPaymentJsLibTranslations)) {
                    return getTrustPaymentJsLibTranslations();
                }

                return { "Pay": "Pay Now" };

            };


            /*
             * Logging isprovided in the payment component using a method named logTrustPaymentJsLib.
             */
            var log = function (a) {

                if (typeof logTrustPaymentJsLib !== 'undefined' && jQuery.isFunction(logTrustPaymentJsLib)) {
                    logTrustPaymentJsLib(a);
                }

            };

            /*
             * Handle any mutations of input elements
             */
            function handleMutations(target, mutations) {
                for (let mutation of mutations) {
                    if (mutation.removedNodes) {
                        for (let node of mutation.removedNodes) {
                            if (node.nodeType === 1 && node.nodeName === "INPUT") {
                                //Append the input back to the target form
                                target.append(node);
                            }
                        }
                    }
                }
            };

            /*
             * Start the mutation observer on the new card form.
             * 
             * Why do we need a mutation observer?
             * 
             * When we use a combination of st.js saved-card and payment pages new-card, submitting
             * the saved-card form strips inputs from the payment pages form.
             * 
             * This results in a scenario where if the saved-card payment fails, and the customer
             * attempts to the new-card payment, the new-card payment also fails because it no
             * longer has the required fields for the st payment pages interface.
             * 
             * To prevent this from happening we watch the payment pages form and if an input is
             * removed we add it back in.
             */
            function startMutationObserver() {

                // select the target node
                const target = document.querySelector("div.new-card-hosted form");

                if (target) {

                    // create an observer instance
                    const observer = new MutationObserver((mutations) => handleMutations(target, mutations));

                    // configuration of the observer:
                    let obconfig = {
                        childList: true,
                        subtree: true
                    };

                    // pass in the target node, as well as the observer options
                    observer.observe(target, obconfig);

                }

            }

            //Start the mutation observer for restoring inputs that should not be deleted.
            startMutationObserver();

            //Why do we need to tell st which fields to submit, should it not just submit any st field in the form?
            //Keep an array of the fields that need to be submitted to st.
            let fieldsToSubmit = []

            //If the payment is being performed by a call-centre use it will be a MOTO transaction and we cannot ask for the security code so
            if (!config.IsMoto) fieldsToSubmit = [...fieldsToSubmit, 'securitycode'];

            //If this is a new-card payment we need to include the pan and expiry date.
            if (!config.IsSavedCardPayment) {
                fieldsToSubmit = [...fieldsToSubmit, 'pan', 'expirydate']
            }

            const tokenizedStSettings;

            // Take the configuration from tradeit and generate settings that st understands.
            const stSettings = {
                jwt: config.Jwt,
                buttonId: getButtonId(config.PaymentControlClientID, config.ButtonName, config.ButtonValue),
                formId: getFormId(config.PaymentControlClientID),
                styles: getStyles(),
                translations: getTranslations(),
                fieldsToSubmit: fieldsToSubmit,
                livestatus: config.LiveStatus
            };

            let formSelector = `form#${stSettings.formId}`; // will either be the new card or saved card depends on which mode we are in.
            let submitButtonSelector = `#${stSettings.buttonId}`;

            //record the config against the form for use when submitting the form.
            $(`#${stSettings.formId}`).data("st-config", config);

            if (config.tokenizedConfig) {

                var formId = getFormId(config.tokenizedConfig.PaymentControlClientID);
                $(`#${formId}`).data(stConfigDataAttribute, config.tokenizedConfig);

                $(`#${formId} [data-stid='st-security-code']`).attr("id", "st-tokenized-security-code");

                //added styles here to try and 
                tokenizedStSettings = {
                    buttonId: getButtonId(config.tokenizedConfig.PaymentControlClientID, config.tokenizedConfig.ButtonName, config.tokenizedConfig.ButtonValue),
                    securityCodeSlotId: 'st-tokenized-security-code',
                    formId: formId,
                    placeholder: 'cvv',
                    styles: getStyles()
                }

                log(tokenizedStSettings);

                formSelector += `, form#${tokenizedStSettings.formId}`
                submitButtonSelector += `, #${tokenizedStSettings.buttonId}`

            }

            //Override the data center Url if the configuration is for the US gateway.
            if (config.Gateway && config.Gateway === 1) {
                stSettings.datacenterurl = "https://webserves.securetrading.us/jwt/";
            }

            //Build TP Form elements for TP JavaScript
            var $stForms = $(formSelector);
            var $payNowButtons = $(submitButtonSelector);

            if ($stForms.length > 0 && $payNowButtons.length > 0) {

                //expand the first accordion
                $stForms.first().parentsUntil(".responsive-accordion").find(".accordion-toggle").click();

                $("[data-stid]:not([id])", $stForms).each(function () {
                    $(this).attr("id", $(this).attr("data-stid"));
                })

                //Ensure we only add one of these notification frames to the page
                if ($('#st-notification-frame').length == 0) {
                    $('<div>').attr({ id: 'st-notification-frame' }).insertBefore($stForms.first());
                }

                //Insert card security field placeholder
                var $cardSecurityCodeField = $('<div>').attr({ id: 'st-security-code-saved', class: 'st-security-code-saved' });
                $cardSecurityCodeField.insertBefore($payNowButtons);

                //Start the secure trading payment system.
                var st = SecureTrading(stSettings);
                st.Components();

                //A callback method used when the saved card is changed by the user.
                let cardChangeCallback;
                let cardChangeConfig;

                //If we are using saved cards as the only js payment method then we need to use updateJWT when the card is changed.
                if (config.IsSavedCardPayment) {

                    cardChangeCallback = function (jwt) {
                        log(jwt);

                        st.updateJWT(jwt);

                        //enable the pay now button now that a card is selected
                        $payNowButtons.prop("disabled", false);
                    }

                    //Record which settings to use for the change handler
                    cardChangeConfig = config;

                }

                //If we have inlined tokenized payment then we need to use st's adapter to update the jwt
                if (!config.IsSavedCardPayment && config.tokenizedConfig && tokenizedStSettings) {

                    console.warn("Init inline tokenized payment")

                    let adapter = st.TokenizedCardPayment(config.tokenizedConfig.Jwt, tokenizedStSettings);

                    cardChangeCallback = function (jwt) {
                        log(jwt);

                        adapter.then(function (adapter) {

                            //Update the token JWT with the newly selected card
                            adapter.updateTokenizedJWT(jwt);

                            //enable the pay now button now that a card is selected
                            $payNowButtons.prop("disabled", false);

                        });

                    }

                    //Record which settings to use for the change handler
                    cardChangeConfig = config.tokenizedConfig;

                }

                //If we have a call back then handle the card change event.
                if (cardChangeCallback && cardChangeConfig) {

                    //Make sure the first radio button is selected.
                    $('input[name=tokenization-selectedcard]', $stForms).first().prop("checked", true);

                    $('input[name=tokenization-selectedcard]', $stForms).on('change', function () {

                        //Disable the pay button whilst we refresh the token
                        $payNowButtons.prop("disabled", true);

                        //Get selected tokenised card reference
                        var selectedTokenisationRef = $(this).val();

                        var data = {
                            TransactionReference: cardChangeConfig.TransactionReference,
                            TransactionSignature: cardChangeConfig.TransactionSignature,
                            TokenisationReference: selectedTokenisationRef,
                            IsSavedCard: true
                        };

                        //Get the updated JWT from the tradeit environment.
                        $.ajax({
                            type: "POST",
                            dataType: "json",
                            contentType: "application/json; charset=utf-8",
                            data: JSON.stringify(data),
                            url: '/services/api/common/trustpayments/getupdatedjwt'
                        }).then(cardChangeCallback).catch(function (err) {
                            log(err);
                        });

                    });

                }

                //When a paynow button is clicked. - note we don't handle the form submission as st.js handles
                //that and we want to run our logic before they payment.
                $payNowButtons.on('click', function (e) {

                    var $targetPayNowButton = $(this); // the button clicked
                    var $targetForm = $targetPayNowButton.parents("form"); // the containing form... could be saved card or new card form
                    var targetConfig = $targetForm.data(stConfigDataAttribute); // the config stored against the form.

                    var containerid = $targetForm.attr("id"); //.payment-tokenization-interface

                    //This handles the saved selected error messages, we have to make sure a card is selected.
                    $("#savedcardinvalid", $targetForm).hide();
                    if (targetConfig.IsSavedCardPayment && !$("[name=tokenization-selectedcard]:checked", $targetForm).val()) {
                        $("#savedcardinvalid", $targetForm).show();

                        //Prevent the form from being submitted until a card is selected.
                        e.preventDefault();

                        //Make sure the click event isn't propogated.
                        e.stopImmediatePropagation();
                    }

                    //Disable the button, st.js does this as well I think but only on the form submission so
                    //this is a bit earlier and prevents multiple payments whilst tradeit does its checks.
                    $targetPayNowButton.prop('disabled', true);

                    //Reload the payment page, let tradeit handle the current state of the session and basket.
                    var doRefresh = function () {
                        st.destroy();

                        window.location.href = location.href;
                    }

                    //submit the payment form, it should now contain the jwt from Trust Payments.
                    var doFormSubmission = function () {
                        var submitButtonName = $targetPayNowButton.attr("name");

                        //Make sure we record the submit button name and value as tradeit payment control will need that.
                        //I think we had some problems with st.js changing the pay now button name and value at some point
                        //so we added this to prevent the value from being lost.
                        if ($("input[type=hidden][name=" + submitButtonName + "]", $targetForm).length === 0) {
                            $targetForm.append("<input type='hidden' name='" + submitButtonName + "' value='" + $targetPayNowButton.val() + "' />");
                            $targetPayNowButton.attr("name", "");
                            $targetPayNowButton.val("");
                        }

                    }

                    //Ensure the tradeit session is active before we submit the form.
                    $.ajax({
                        type: "GET",
                        url: window.location.pathname,
                        async: false,
                        error: function () {

                            //An error occured Session is not active destroy st and reload the window.
                            doRefresh();

                        },
                        success: function (response) {

                            //No error occured so now we need to check the response to make sure the payment method is still available.
                            var virtualDom = document.implementation.createHTMLDocument('payment-response');

                            var responseHtml = $.parseHTML(response, virtualDom);

                            if ($("#" + containerid, responseHtml).length > 0) {

                                if (targetConfig.IsNewCardPayment) {

                                    //Before we can submit the new card form we must update the address by getting a new jwt from the server and using st.updatJWT to change it.
                                    //This only applies to new cards, saved cards will use the payment address that is recorded against the parent transaction.

                                    var address = {}

                                    // create a collection of payment address fields.
                                    $('[name^="payment_address_"]', $targetForm).each(function () {

                                        var name = snakeToCamel($(this).attr("name"));
                                        var value = $(this).val();

                                        address[name] = value;

                                    });

                                    //Maintain whether we are going to save the card after payment.
                                    //Note that for subscriptions this is mandatory.
                                    //Note that Trust Payments will 'save' the card any way this just indicate is tradeit will dispaly it to the customer as a saved card.
                                    var saveCardVal = $('input[name="save_token"]', $targetForm).val();

                                    var data = {
                                        TransactionReference: targetConfig.TransactionReference,
                                        TransactionSignature: targetConfig.TransactionSignature,
                                        SaveCard: saveCardVal == null || saveCardVal.toLowerCase() !== 'yes' ? false : true,
                                        PaymentAddress: address,
                                        IsSavedCard: false
                                    };

                                    //Get the updated JWT 
                                    $.ajax({
                                        type: "POST",
                                        dataType: "json",
                                        contentType: "application/json; charset=utf-8",
                                        data: JSON.stringify(data),
                                        url: '/services/api/common/trustpayments/getupdatedjwt',
                                        async: false
                                    }).then(function (jwt) {

                                        st.updateJWT(jwt);

                                        doFormSubmission();

                                    }).catch(function (err) {
                                        log(err);

                                        doRefresh()
                                    });

                                } else {

                                    doFormSubmission();

                                }

                            } else {

                                doRefresh()

                            }

                        }

                    });

                });

                /*
                 * The delete card button must destroy the secure trading instance to ensure the form submission is allowed.
                 * 
                 * Without this the form will not be submitted.
                 */
                $("button[name=tokenization-delete]:not([data-toggle='modal'])", $stForms).click(function () {
                    st.destroy();
                });

                //Start the GooglePay payment options
                if (config.GooglePaySettings) {
                    console.log("Start Google Pay")
                    st.GooglePay(config.GooglePaySettings);
                }

                //Start the ApplyPay payment option
                if (config.ApplePaySettings) {
                    console.log("Start Apple Pay")
                    st.ApplePay(config.ApplePaySettings);
                }

            }

        };


        /*
         * CookieConsent class constructor.
         */
        function constructor() {

            //TODO: Revist this, this is a strange way to initialise the TP instances, probably has something
            // to do with how tradeit defers jQuery that we need both DOMContentLoaded and jquery read.
            window.addEventListener('DOMContentLoaded', (event) => {
                $(function () { initTpInstances() });
            });

        }

        //start the cookie consent
        constructor();

        return {
            addTpInstance: addTpInstance
        };

    }

    //Start the cookie consent by constructing a cookie consent instance.
    window.tradeItTrustPayments = window.tradeItTrustPayments || new TradeItTrustPayments();

})();



/*
 * 
 * THE BELOW IS EMBEDDED IN THE PAGE
 * 
 */


/*
 * Customise the styling of the Trust Payments payment CV2 input.
 */
var getTrustPaymentJsLibStyles = function () {
    return {
        'background-color-body': '#fff',
        'font-size-label': '13px',
        'color-input': '#333',
        'border-radius-input': '0px',
        'color-input-error': '#333',
        'border-color-input-error': '#c00',
        'background-color-input-error': '#fff',
        'border-radius-input-error': '0px',
        'color-error': '#c00',
        'display-label': 'none'
    };
};



/*
 * Customise the translations of the Trust Payments payments CV2 input and errors.
 */
var getTrustPaymentJsLibTranslations = function () {
    return {
        'A target element for the input field with id could not be found. Please check your configuration': 'An error occured whilst processing your payment, please try again in a few minutes or try another payment method.',
        'Amount and currency are not set': 'An error occured whilst processing your payment, please try again in a few minutes or try another payment method.',
        'An error occurred': 'An error occured whilst processing your payment, please try again in a few minutes or try another payment method.',
        'Decline': 'Your transaction was declined, please try another card or payment method.',
        'Form is not valid': 'An error occured whilst processing your payment, please try again in a few minutes or try another payment method.',
        'Invalid field': 'An invalid value has been specified.',
        'Invalid request': 'An error occured whilst processing your payment, please try again in a few minutes or try another payment method.',
        'Invalid response': 'An error occured whilst processing your payment, please try again in a few minutes or try another payment method.',
        'Merchant validation failure': 'An error occured whilst processing your payment, please try again in a few minutes or try another payment method.',
        'Method not implemented': 'An error occured whilst processing your payment, please try again in a few minutes or try another payment method.',
        'Payment has been cancelled': 'You have cancelled your payment, please try again or use another payment method.',
        'Payment has been successfully processed': 'Payment has been successfully processed.',
        'Timeout': 'An error occured whilst processing your payment, please try again in a few minutes or try another payment method. - REF: Timeout',
        'You are not logged to Apple account': 'You are not logged to Apple account.',
        'Card number': 'Card number',
        'Expiration date': 'Expiration date',
        'Security code': 'Security code',
        'Pay': 'Pay Now',
        'Processing': 'Processing...',
        'Field is required': 'This field is required.',
        'Value is too short': 'The value you entered is too short.',
        'Unauthenticated': 'Your card could not be authenticated, please try a different card.'
    };
};

window.tradeItTrustPayments.addTpInstance("newcard", {
    "TransactionReference": "3450-2330",
    "TransactionSignature": "5A6F8F18B9C85B948D0B152FFE10A8C56416B059117D83ED003C2849C9859339",
    "LiveStatus": 0,
    "PaymentControlClientID": "ctl00_Content_ctl01_ctl07_ppNewCardHosted",
    "Jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2NTM0ODQ5MjMsImlzcyI6Imp3dEByZWR0ZWNobm9sb2d5LmNvbSIsInBheWxvYWQiOnsiYWNjb3VudHR5cGVkZXNjcmlwdGlvbiI6IkVDT00iLCJjdXJyZW5jeWlzbzNhIjoiR0JQIiwibWFpbmFtb3VudCI6MTQ0Ny45OSwic2l0ZXJlZmVyZW5jZSI6InRlc3RfcmVkdGVjaG5vbG9neTc5OTk5IiwibG9jYWxlIjoiZW5fR0IiLCJzZXR0bGVzdGF0dXMiOjEsIm9yZGVycmVmZXJlbmNlIjoiMzQ1MC0yMzMwIiwiY3VzdG9tZXJlbWFpbCI6ImFkbWluQGRldi5yZWR0ZWNobm9sb2d5LmNvbSIsImN1c3RvbWVyZmlyc3RuYW1lIjoiVHJhZGVpdCIsImN1c3RvbWVybGFzdG5hbWUiOiJBZG1pbmlzdHJhdG9yIiwiY3VzdG9tZXJwcmVtaXNlIjoiMiBUaGUgU3dlcmUiLCJjdXN0b21lcnN0cmVldCI6IkRlZGRpbmd0b24iLCJjdXN0b21lcnRvd24iOiJveGZvcmQiLCJjdXN0b21lcnBvc3Rjb2RlIjoiT1gxNTBBQSIsImN1c3RvbWVyY291bnR5IjoiIiwiY3VzdG9tZXJjb3VudHJ5aXNvMmEiOiJHQiIsImN1c3RvbWVydGVsZXBob25lIjoiMDEyMzQ1Njc4OSIsImJpbGxpbmdlbWFpbCI6ImFkbWluQGRldi5yZWR0ZWNobm9sb2d5LmNvbSIsImJpbGxpbmdmaXJzdG5hbWUiOiJCRiIsImJpbGxpbmdsYXN0bmFtZSI6IkJTIiwiYmlsbGluZ3ByZW1pc2UiOiJuZXcgYWRkcmVzcyAzIiwiYmlsbGluZ3N0cmVldCI6Im5ldyBhZGRyZXNzIDMiLCJiaWxsaW5ndG93biI6Im94Zm9yZCIsImJpbGxpbmdwb3N0Y29kZSI6IkFVMTIzQk8iLCJiaWxsaW5nY291bnR5IjoiIiwiYmlsbGluZ2NvdW50cnlpc28yYSI6Ik5aIiwiYmlsbGluZ3RlbGVwaG9uZSI6IjEyMzQ1Njc4OSIsImNyZWRlbnRpYWxzb25maWxlIjoiMSIsInJlcXVlc3R0eXBlZGVzY3JpcHRpb25zIjpbIlRIUkVFRFFVRVJZIiwiQVVUSCJdfX0.Qg2aMsukrfkLifeQWCzXdv1ZTovJiOJxzo1oM2FhE20",
    "Gateway": 0,
    "ButtonName": "newcard-paynow",
    "ButtonValue": "paynow",
    "IsNewCardPayment": true,
    "GooglePaySettings": null,
    "ApplePaySettings": null
});


window.tradeItTrustPayments.addTpInstance("savedcard", {
    "TransactionReference": "3450-2329",
    "TransactionSignature": "D02B29FD2895DE5ABD06C2CD51CECAB16BB53493634A9F1471A09ACC653E55AE",
    "LiveStatus": 0,
    "PaymentControlClientID": "ctl00_Content_ctl01_ctl03_ppTokenization",
    "ButtonName": "tokenization-paynow",
    "ButtonValue": "paynow",
    "Jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2NTM0ODQ5MjIsImlzcyI6Imp3dEByZWR0ZWNobm9sb2d5LmNvbSIsInBheWxvYWQiOnsiYWNjb3VudHR5cGVkZXNjcmlwdGlvbiI6IkVDT00iLCJjdXJyZW5jeWlzbzNhIjoiR0JQIiwibWFpbmFtb3VudCI6MTQ0Ny45OSwic2l0ZXJlZmVyZW5jZSI6InRlc3RfcmVkdGVjaG5vbG9neTc5OTk5IiwibG9jYWxlIjoiZW5fR0IiLCJzZXR0bGVzdGF0dXMiOjEsIm9yZGVycmVmZXJlbmNlIjoiMzQ1MC0yMzI5IiwicGFyZW50dHJhbnNhY3Rpb25yZWZlcmVuY2UiOiI1OS05LTIyMjUwMTYiLCJjdXN0b21lcmVtYWlsIjoiYWRtaW5AZGV2LnJlZHRlY2hub2xvZ3kuY29tIiwiY3VzdG9tZXJmaXJzdG5hbWUiOiJUcmFkZWl0IiwiY3VzdG9tZXJsYXN0bmFtZSI6IkFkbWluaXN0cmF0b3IiLCJjdXN0b21lcnByZW1pc2UiOiIyIFRoZSBTd2VyZSIsImN1c3RvbWVyc3RyZWV0IjoiRGVkZGluZ3RvbiIsImN1c3RvbWVydG93biI6Im94Zm9yZCIsImN1c3RvbWVycG9zdGNvZGUiOiJPWDE1MEFBIiwiY3VzdG9tZXJjb3VudHkiOiIiLCJjdXN0b21lcmNvdW50cnlpc28yYSI6IkdCIiwiY3VzdG9tZXJ0ZWxlcGhvbmUiOiIwMTIzNDU2Nzg5IiwiYmlsbGluZ2VtYWlsIjoiYWRtaW5AZGV2LnJlZHRlY2hub2xvZ3kuY29tIiwiYmlsbGluZ2ZpcnN0bmFtZSI6IkJGIiwiYmlsbGluZ2xhc3RuYW1lIjoiQlMiLCJiaWxsaW5ncHJlbWlzZSI6Im5ldyBhZGRyZXNzIDMiLCJiaWxsaW5nc3RyZWV0IjoibmV3IGFkZHJlc3MgMyIsImJpbGxpbmd0b3duIjoib3hmb3JkIiwiYmlsbGluZ3Bvc3Rjb2RlIjoiQVUxMjNCTyIsImJpbGxpbmdjb3VudHkiOiIiLCJiaWxsaW5nY291bnRyeWlzbzJhIjoiTloiLCJiaWxsaW5ndGVsZXBob25lIjoiMTIzNDU2Nzg5IiwiY3JlZGVudGlhbHNvbmZpbGUiOiIyIiwicmVxdWVzdHR5cGVkZXNjcmlwdGlvbnMiOlsiVEhSRUVEUVVFUlkiLCJBVVRIIl19fQ.NepxVYdS4u-01HO7SL0t9Ij015NGQIvGrl_4NW4GZ2c",
    "Gateway": 0,
    "IsSavedCardPayment": true,
    "IsMoto": false
});


